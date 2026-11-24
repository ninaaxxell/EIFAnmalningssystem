"use strict";

/* ------------------------------------------------------------------
   admin.js: administratörens sida ("Administration")

   Visar:
   1. Aktiviteter och anmälningar: välj en aktivitet och se vilka som
      är anmälda och om de har betalat.
      - Träning: betald om medlemmens årsavgift är betald (automatiskt).
      - Evenemang: administratören markerar varje anmälan som betald
        med en knapp. Raden blir då grön.
   2. Evenemang: administratören kan skapa, redigera och ta bort evenemang.
   3. Medlemmar och årsavgift: alla medlemmar, grön = betald, röd = obetald.

   Använder funktioner från de andra filerna:
   - roles.js:       isAdmin()
   - members.js:     getAllMembers(), hasPaidAnnualFee()
   - activities.js:  loadActivities(), getAllActivities(), getAllCoaches(),
                     getCoachById()
   - member-view.js: formatDate()

   Anmälda och betalda sparas i aktiviteten, i två listor med
   medlemsnummer:
     deltagare   de som är anmälda (om listan finns)
     betalda     de som administratören har markerat som betalda
   Ändringarna finns kvar tills sidan laddas om (ingen databas).
------------------------------------------------------------------- */

// Så här är evenemang markerade i träningsschemat (kategori).
// Alla andra aktiviteter är träningar.
const EVENT_CATEGORY = "Evenemang";

// Veckodagarna, i den ordning som JavaScript räknar dem (söndag först)
const WEEKDAYS = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"];

// Håller reda på om rullgardinsmenyn behöver fyllas i (på nytt)
let adminMenuIsFilled = false;

// Aktiviteten som är vald just nu
let currentActivity = null;

// Vilket evenemang som redigeras. null betyder att ett nytt skapas.
let editingEventId = null;

// Vilken aktivitet som ska väljas när menyn fylls i på nytt
let pendingSelectId = null;

/* ---------- Hjälpfunktioner ---------- */

// Är aktiviteten ett evenemang? (annars är den en träning)
function isEvent(activity) {
  return activity.kategori === EVENT_CATEGORY;
}

// Veckodagens namn för ett datum som "2027-03-13"
function weekdayOf(isoDate) {
  return WEEKDAYS[new Date(isoDate + "T12:00:00").getDay()];
}

// Skapar rutan "Aktiviteter och anmälningar" i adminvyn om den inte
// redan finns i index.html
function ensureActivityCard() {
  if (document.getElementById("admin-activities") !== null) {
    return;
  }

  const adminView = document.getElementById("admin");
  const card = document.createElement("article");
  card.className = "card card-wide";
  card.innerHTML =
    "<h2>Aktiviteter och anmälningar</h2>" +
    '<label class="field">Välj aktivitet ' +
    '<select id="admin-activity-select"></select></label>' +

    '<div class="admin-toolbar">' +
    '<button type="button" id="admin-new-event" class="btn-ghost">Nytt evenemang</button>' +
    '<button type="button" id="admin-edit-event" class="btn-ghost" hidden>Redigera evenemang</button>' +
    '<button type="button" id="admin-delete-event" class="btn-ghost btn-danger" hidden>Ta bort evenemang</button>' +
    "</div>" +

    '<form id="admin-event-form" hidden novalidate>' +
    '<h3 id="admin-event-form-title"></h3>' +
    '<p id="admin-event-form-error" class="error" role="alert" hidden></p>' +
    '<label class="field">Namn <input type="text" id="ev-namn" required></label>' +
    '<label class="field">Datum <input type="date" id="ev-datum" required></label>' +
    '<label class="field">Tid <input type="time" id="ev-tid" required></label>' +
    '<label class="field">Plats <input type="text" id="ev-plats" required></label>' +
    '<label class="field">Tränare <select id="ev-tranare"></select></label>' +
    '<label class="field">Max antal deltagare <input type="number" id="ev-max" min="1" required></label>' +
    '<label class="field">Avgift (€) <input type="number" id="ev-avgift" min="0" step="0.01" required></label>' +
    '<button type="submit" class="btn-primary">Spara</button> ' +
    '<button type="button" id="ev-cancel" class="btn-ghost">Avbryt</button>' +
    "</form>" +

    '<div id="admin-activities"></div>';

  // Lägg rutan först i adminvyn, före listan med medlemmar
  adminView.insertBefore(card, adminView.querySelector("article"));

  // Koppla knapparna (görs bara en gång, när rutan skapas)
  document.getElementById("admin-activity-select").addEventListener("change", function () {
    closeEventForm();
    renderAdminActivity();
  });
  document.getElementById("admin-new-event").addEventListener("click", function () {
    openEventForm(null);
  });
  document.getElementById("admin-edit-event").addEventListener("click", function () {
    openEventForm(currentActivity);
  });
  document.getElementById("admin-delete-event").addEventListener("click", function () {
    deleteEvent(currentActivity);
  });
  document.getElementById("admin-event-form").addEventListener("submit", saveEvent);
  document.getElementById("ev-cancel").addEventListener("click", closeEventForm);
}

// Vilka medlemmar är anmälda till aktiviteten?
async function getActivityParticipants(activity) {
  const members = await getAllMembers();
  const result = [];

  for (let i = 0; i < members.length; i++) {
    const number = members[i].medlemsnummer;

    if (Array.isArray(activity.deltagare)) {
      // Det finns en lista över anmälda: använd den
      if (activity.deltagare.includes(number)) {
        result.push(members[i]);
      }
    } else if (isEvent(activity) === false && members[i].lag === activity.namn) {
      // Träning utan lista: laget är anmäld från början
      result.push(members[i]);
    }
  }
  return result;
}

// Har deltagaren betalat för aktiviteten?
async function isParticipantPaid(activity, member) {
  // Träning: följer årsavgiften
  if (isEvent(activity) === false) {
    return await hasPaidAnnualFee(member.medlemsnummer);
  }
  // Evenemang: finns medlemmen i listan "betalda"?
  return Array.isArray(activity.betalda) && activity.betalda.includes(member.medlemsnummer);
}

// Markera en anmälan till ett evenemang som betald (eller ta bort markeringen)
function toggleEventPayment(activity, memberNumber) {
  // Bara administratören får ändra betalningar
  if (isAdmin() === false || isEvent(activity) === false) {
    return;
  }

  if (Array.isArray(activity.betalda) === false) {
    activity.betalda = [];
  }

  const index = activity.betalda.indexOf(memberNumber);
  if (index === -1) {
    activity.betalda.push(memberNumber);   // markera som betald
  } else {
    activity.betalda.splice(index, 1);     // ångra
  }

  renderAdminActivity(); // rita om så att färgen ändras
}

// Text för en aktivitet i rullgardinsmenyn
function activityLabel(activity) {
  let text = activity.veckodag.slice(0, 3) + " " + formatDate(activity.datum) +
    " kl. " + activity.tid + " – " + activity.namn;
  if (isEvent(activity)) {
    text = "[Evenemang] " + text;
  }
  return text;
}

/* ---------- Skapa, redigera och ta bort evenemang ---------- */

// Visar formuläret. activity = null ger ett tomt formulär (nytt evenemang).
async function openEventForm(activity) {
  if (isAdmin() === false) {
    return;
  }

  editingEventId = (activity === null) ? null : activity.id;

  document.getElementById("admin-event-form-title").textContent =
    (activity === null) ? "Nytt evenemang" : "Redigera evenemang";

  // Fyll i listan med tränare
  const coachSelect = document.getElementById("ev-tranare");
  const coaches = await getAllCoaches();
  coachSelect.replaceChildren();
  for (let i = 0; i < coaches.length; i++) {
    const option = document.createElement("option");
    option.value = coaches[i].tranare_id;
    option.textContent = coaches[i].namn + " (" + coaches[i].tranare_id + ")";
    coachSelect.append(option);
  }

  // Fyll i fälten
  if (activity === null) {
    document.getElementById("ev-namn").value = "";
    document.getElementById("ev-datum").value = "";
    document.getElementById("ev-tid").value = "18:00";
    document.getElementById("ev-plats").value = "EIF-hallen, Västerby";
    document.getElementById("ev-max").value = "20";
    document.getElementById("ev-avgift").value = "0";
  } else {
    document.getElementById("ev-namn").value = activity.namn;
    document.getElementById("ev-datum").value = activity.datum;
    document.getElementById("ev-tid").value = activity.tid;
    document.getElementById("ev-plats").value = activity.plats;
    document.getElementById("ev-max").value = activity.max_deltagare;
    document.getElementById("ev-avgift").value =
      (activity.avgift_eur === undefined) ? 0 : activity.avgift_eur;
    coachSelect.value = activity.tranare_id;
  }

  document.getElementById("admin-event-form-error").hidden = true;
  document.getElementById("admin-event-form").hidden = false;
  document.getElementById("ev-namn").focus();
}

// Döljer formuläret
function closeEventForm() {
  const form = document.getElementById("admin-event-form");
  if (form !== null) {
    form.hidden = true;
  }
  editingEventId = null;
}

// Visar ett felmeddelande i formuläret
function showEventFormError(text) {
  const box = document.getElementById("admin-event-form-error");
  box.textContent = text;
  box.hidden = false;
}

// Sparar formuläret: skapar ett nytt evenemang eller ändrar ett befintligt
async function saveEvent(event) {
  event.preventDefault();

  // Bara administratören får skapa eller ändra evenemang
  if (isAdmin() === false) {
    return;
  }

  const namn = document.getElementById("ev-namn").value.trim();
  const datum = document.getElementById("ev-datum").value;
  const tid = document.getElementById("ev-tid").value;
  const plats = document.getElementById("ev-plats").value.trim();
  const tranareId = document.getElementById("ev-tranare").value;
  const max = Number(document.getElementById("ev-max").value);
  const avgift = Number(document.getElementById("ev-avgift").value);

  // Kontrollera det som skrivits in
  if (namn === "" || datum === "" || tid === "" || plats === "") {
    showEventFormError("Fyll i namn, datum, tid och plats.");
    return;
  }
  if (Number.isInteger(max) === false || max < 1) {
    showEventFormError("Max antal deltagare måste vara ett heltal på minst 1.");
    return;
  }
  if (isNaN(avgift) || avgift < 0) {
    showEventFormError("Avgiften kan inte vara negativ.");
    return;
  }

  const coach = await getCoachById(tranareId);
  const coachName = (coach === null) ? "" : coach.namn;

  try {
    const list = await loadActivities(); // själva listan med aktiviteter

    if (editingEventId === null) {
      // ---- Skapa nytt evenemang ----
      let highest = 0;
      for (let i = 0; i < list.length; i++) {
        if (list[i].id > highest) {
          highest = list[i].id;
        }
      }
      const created = {
        id: highest + 1,
        namn: namn,
        kategori: EVENT_CATEGORY,
        datum: datum,
        veckodag: weekdayOf(datum),
        tid: tid,
        plats: plats,
        tranare_id: tranareId,
        tranare_namn: coachName,
        max_deltagare: max,
        antal_anmälda: 0,
        avgift_eur: avgift,
        deltagare: [],
        betalda: []
      };
      list.push(created);
      pendingSelectId = created.id;

    } else {
      // ---- Redigera befintligt evenemang ----
      let target = null;
      for (let i = 0; i < list.length; i++) {
        if (list[i].id === editingEventId) {
          target = list[i];
        }
      }
      if (target === null) {
        showEventFormError("Evenemanget hittades inte.");
        return;
      }
      // Max får inte vara lägre än antalet som redan är anmälda
      const registered = Array.isArray(target.deltagare) ? target.deltagare.length : 0;
      if (max < registered) {
        showEventFormError("Max kan inte vara lägre än antalet anmälda (" + registered + ").");
        return;
      }

      target.namn = namn;
      target.datum = datum;
      target.veckodag = weekdayOf(datum);
      target.tid = tid;
      target.plats = plats;
      target.tranare_id = tranareId;
      target.tranare_namn = coachName;
      target.max_deltagare = max;
      target.avgift_eur = avgift;
      pendingSelectId = target.id;
    }

    closeEventForm();
    adminMenuIsFilled = false; // fyll i menyn på nytt
    await renderAdminActivity();

  } catch (error) {
    showEventFormError("Kunde inte spara: " + error.message);
  }
}

// Tar bort ett evenemang (efter att administratören har bekräftat)
async function deleteEvent(activity) {
  if (isAdmin() === false || activity === null || isEvent(activity) === false) {
    return;
  }

  const sure = confirm(
    'Ta bort evenemanget "' + activity.namn + '"? Anmälningarna försvinner också.'
  );
  if (sure === false) {
    return;
  }

  const list = await loadActivities();
  const index = list.indexOf(activity);
  if (index !== -1) {
    list.splice(index, 1);
  }

  closeEventForm();
  adminMenuIsFilled = false; // fyll i menyn på nytt
  await renderAdminActivity();
}

/* ---------- 1. Aktiviteter och anmälningar ---------- */

async function renderAdminActivity() {
  const select = document.getElementById("admin-activity-select");
  const box = document.getElementById("admin-activities");
  if (select === null || box === null) {
    return;
  }

  try {
    const all = await getAllActivities();

    // Sortera efter datum och tid
    all.sort(function (a, b) {
      return (a.datum + a.tid).localeCompare(b.datum + b.tid);
    });

    // Fyll rullgardinsmenyn (första gången, och efter att evenemang ändrats)
    if (adminMenuIsFilled === false) {
      select.replaceChildren();
      for (let i = 0; i < all.length; i++) {
        const option = document.createElement("option");
        option.value = all[i].id;
        option.textContent = activityLabel(all[i]);
        select.append(option);
      }
      if (pendingSelectId !== null) {
        select.value = String(pendingSelectId);
        pendingSelectId = null;
      }
      adminMenuIsFilled = true;
    }

    // Den aktivitet som är vald i menyn
    let activity = all[0];
    for (let i = 0; i < all.length; i++) {
      if (String(all[i].id) === select.value) {
        activity = all[i];
      }
    }
    currentActivity = activity;

    // Knapparna för att ändra och ta bort visas bara för evenemang
    document.getElementById("admin-edit-event").hidden = !isEvent(activity);
    document.getElementById("admin-delete-event").hidden = !isEvent(activity);

    const participants = await getActivityParticipants(activity);

    // Räkna betalda
    const paidList = [];
    let paidCount = 0;
    for (let i = 0; i < participants.length; i++) {
      const paid = await isParticipantPaid(activity, participants[i]);
      paidList.push(paid);
      if (paid) {
        paidCount++;
      }
    }

    box.replaceChildren();

    // Rubrik och information om aktiviteten
    const heading = document.createElement("h3");
    heading.textContent = activity.namn;
    const info = document.createElement("p");
    info.textContent =
      activity.veckodag + " " + formatDate(activity.datum) + " kl. " + activity.tid +
      ", " + activity.plats + ". Anmälda: " + participants.length +
      " av " + activity.max_deltagare + ". Betalda: " + paidCount + "." +
      (isEvent(activity) && activity.avgift_eur !== undefined
        ? " Avgift: " + activity.avgift_eur + " €."
        : "");
    const note = document.createElement("p");
    note.className = "muted";
    note.textContent = isEvent(activity)
      ? "Evenemang: klicka på knappen när en anmälan är betald."
      : "Träning: betald om årsavgiften är betald.";
    box.append(heading, info, note);

    if (participants.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "Inga anmälda till den här aktiviteten.";
      box.append(empty);
      return;
    }

    // Tabellen med deltagare
    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    const table = document.createElement("table");
    table.className = "data";

    const headRow = table.createTHead().insertRow();
    const headings = ["Medlem", "Betalning"];
    for (let i = 0; i < headings.length; i++) {
      const th = document.createElement("th");
      th.textContent = headings[i];
      headRow.append(th);
    }

    const tbody = table.createTBody();
    for (let i = 0; i < participants.length; i++) {
      const member = participants[i];
      const paid = paidList[i];

      const row = tbody.insertRow();
      row.className = paid ? "paid" : "unpaid"; // färgmarkering

      row.insertCell().textContent =
        member.fornamn + " " + member.efternamn + " (" + member.medlemsnummer + ")";

      const payCell = row.insertCell();
      payCell.textContent = paid ? "Betald" : "Obetald";

      // Knappen finns bara för evenemang. Träningar följer årsavgiften.
      if (isEvent(activity)) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn-ghost";
        button.textContent = paid ? "Ångra" : "Markera som betald";
        button.addEventListener("click", function () {
          toggleEventPayment(activity, member.medlemsnummer);
        });
        payCell.append(button);
      }
    }

    wrap.append(table);
    box.append(wrap);

  } catch (error) {
    box.textContent = "Kunde inte läsa aktiviteterna: " + error.message;
  }
}

/* ---------- 3. Medlemmar och årsavgift ---------- */

async function renderAdminMembers() {
  const memberList = document.getElementById("admin-members");
  if (memberList === null) {
    return;
  }

  try {
    const members = await getAllMembers();
    memberList.innerHTML = "";

    for (let i = 0; i < members.length; i++) {
      // Kontrollera årsavgiften
      const paid = await hasPaidAnnualFee(members[i].medlemsnummer);

      const row = document.createElement("p");
      row.textContent =
        members[i].fornamn + " " + members[i].efternamn + " – Årsavgift: " +
        (paid ? "Betald" : "Obetald");

      // Färgmarkering
      row.className = paid ? "paid" : "unpaid";
      memberList.append(row);
    }

  } catch (error) {
    console.error("Fel vid hämtning av medlemmar:", error);
    memberList.textContent = "Kunde inte läsa medlemsregistret.";
  }
}

/* ---------- Startpunkt: anropas av scripts.js ---------- */

async function renderAdminView() {
  // Kontrollera att användaren är administratör
  if (isAdmin() === false) {
    return;
  }
  if (document.getElementById("admin") === null) {
    return;
  }

  ensureActivityCard();
  await renderAdminActivity();
  await renderAdminMembers();
}
