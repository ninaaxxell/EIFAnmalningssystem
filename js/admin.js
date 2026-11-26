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
   3. Användare: administratören kan skapa, redigera och ta bort medlemmar.
   4. Lag: administratören kan skapa, redigera och ta bort lag.
   5. Medlemmar och årsavgift: alla medlemmar, grön = betald, röd = obetald.

   Antaganden (gruppen kan ändra dem):
   - "Användare" är medlemmarna i medlemsregistret.
   - Ett lag är en post i tränarlistan i träningsschemat (lagnamn + tränare).
     Lagets namn är samma text som medlemmarnas "lag" och träningarnas "namn".
   - Allt sparas i minnet och försvinner när sidan laddas om.

   Använder funktioner från de andra filerna:
   - roles.js:       isAdmin()
   - members.js:     loadMembers(), getAllMembers(), hasPaidAnnualFee()
   - activities.js:  loadSchedule(), loadActivities(), getAllActivities(),
                     getAllCoaches(), getCoachById(), todayISO()
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

    '<form id="admin-event-form" class="admin-form" hidden novalidate>' +
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

/* ---------- 4. Användare (medlemmar): skapa, redigera, ta bort ---------- */

// Så många medlemmar visas i listan åt gången (sök för att hitta fler)
const USER_ROWS = 20;

// Vilken medlem som redigeras (medlemsnummer). null = ny medlem.
let editingUserNumber = null;

// Det som står i sökrutan
let userSearchText = "";

// Alla lagnamn, i bokstavsordning (lagen finns i tränarlistan)
async function getTeamNames() {
  const coaches = await getAllCoaches();
  const names = [];
  for (let i = 0; i < coaches.length; i++) {
    if (coaches[i].lag !== "" && names.includes(coaches[i].lag) === false) {
      names.push(coaches[i].lag);
    }
  }
  names.sort();
  return names;
}

// Nästa lediga medlemsnummer, till exempel "EIF-1360"
function nextMemberNumber(members) {
  let highest = 1000;
  for (let i = 0; i < members.length; i++) {
    const n = Number(members[i].medlemsnummer.replace("EIF-", ""));
    if (n > highest) {
      highest = n;
    }
  }
  return "EIF-" + (highest + 1);
}

// Vanlig årsavgift i ett lag (samma som de som redan är med i laget)
function defaultFeeFor(lag, members) {
  for (let i = 0; i < members.length; i++) {
    if (members[i].lag === lag) {
      return members[i].arsavgift.belopp_eur;
    }
  }
  return 150;
}

// Skapar rutorna "Användare" och "Lag" i adminvyn om de inte redan finns
function ensureManageCards() {
  if (document.getElementById("admin-users") !== null) {
    return;
  }

  const activityCard = document.getElementById("admin-activities").closest("article");

  // ---- Rutan "Användare" ----
  const usersCard = document.createElement("article");
  usersCard.className = "card card-wide";
  usersCard.innerHTML =
    "<h2>Användare (medlemmar)</h2>" +
    '<label class="field">Sök medlem ' +
    '<input type="search" id="admin-user-search" placeholder="Namn, medlemsnummer eller lag"></label>' +
    '<div class="admin-toolbar">' +
    '<button type="button" id="admin-new-user" class="btn-ghost">Ny medlem</button></div>' +

    '<form id="admin-user-form" class="admin-form" hidden novalidate>' +
    '<h3 id="admin-user-form-title"></h3>' +
    '<p id="admin-user-form-error" class="error" role="alert" hidden></p>' +
    '<label class="field">Förnamn <input type="text" id="u-fornamn" required></label>' +
    '<label class="field">Efternamn <input type="text" id="u-efternamn" required></label>' +
    '<label class="field">Födelseår <input type="number" id="u-fodelsear" min="1930" max="2027" required></label>' +
    '<label class="field">Kön <select id="u-kon"><option value="M">M</option><option value="F">F</option></select></label>' +
    '<label class="field">E-post <input type="email" id="u-epost" required></label>' +
    '<label class="field">Lag <select id="u-lag"></select></label>' +
    '<label class="field">Årsavgift (€) <input type="number" id="u-avgift" min="0" step="0.01" required></label>' +
    '<label class="field">Vårdnadshavare (för barn, valfritt) <input type="text" id="u-vardnadshavare"></label>' +
    '<label class="field field-check"><input type="checkbox" id="u-betald"> Årsavgiften är betald</label>' +
    '<button type="submit" class="btn-primary">Spara</button> ' +
    '<button type="button" id="u-cancel" class="btn-ghost">Avbryt</button>' +
    "</form>" +

    '<div id="admin-users"></div>';

  // ---- Rutan "Lag" ----
  const teamsCard = document.createElement("article");
  teamsCard.className = "card card-wide";
  teamsCard.innerHTML =
    "<h2>Lag</h2>" +
    '<div class="admin-toolbar">' +
    '<button type="button" id="admin-new-team" class="btn-ghost">Nytt lag</button></div>' +
    '<p id="admin-team-message" class="error" role="alert" hidden></p>' +

    '<form id="admin-team-form" class="admin-form" hidden novalidate>' +
    '<h3 id="admin-team-form-title"></h3>' +
    '<p id="admin-team-form-error" class="error" role="alert" hidden></p>' +
    '<label class="field">Lagets namn <input type="text" id="t-lag" required></label>' +
    '<label class="field">Tränarens namn <input type="text" id="t-tranare" required></label>' +
    '<button type="submit" class="btn-primary">Spara</button> ' +
    '<button type="button" id="t-cancel" class="btn-ghost">Avbryt</button>' +
    "</form>" +

    '<div id="admin-teams"></div>';

  activityCard.after(usersCard, teamsCard);

  // Koppla knapparna (görs bara en gång)
  document.getElementById("admin-user-search").addEventListener("input", function (event) {
    userSearchText = event.target.value;
    renderAdminUsers();
  });
  document.getElementById("admin-new-user").addEventListener("click", function () {
    openUserForm(null);
  });
  document.getElementById("admin-user-form").addEventListener("submit", saveUser);
  document.getElementById("u-cancel").addEventListener("click", closeUserForm);

  document.getElementById("admin-new-team").addEventListener("click", function () {
    openTeamForm(null);
  });
  document.getElementById("admin-team-form").addEventListener("submit", saveTeam);
  document.getElementById("t-cancel").addEventListener("click", closeTeamForm);
}

// Visar formuläret. member = null ger ett tomt formulär (ny medlem).
async function openUserForm(member) {
  if (isAdmin() === false) {
    return;
  }

  editingUserNumber = (member === null) ? null : member.medlemsnummer;
  document.getElementById("admin-user-form-title").textContent =
    (member === null) ? "Ny medlem" : "Redigera medlem " + member.medlemsnummer;

  // Fyll i listan med lag
  const teamSelect = document.getElementById("u-lag");
  const teams = await getTeamNames();
  teamSelect.replaceChildren();
  for (let i = 0; i < teams.length; i++) {
    const option = document.createElement("option");
    option.value = teams[i];
    option.textContent = teams[i];
    teamSelect.append(option);
  }

  const members = await getAllMembers();

  if (member === null) {
    document.getElementById("u-fornamn").value = "";
    document.getElementById("u-efternamn").value = "";
    document.getElementById("u-fodelsear").value = "";
    document.getElementById("u-kon").value = "M";
    document.getElementById("u-epost").value = "";
    document.getElementById("u-vardnadshavare").value = "";
    document.getElementById("u-betald").checked = false;
    document.getElementById("u-avgift").value = defaultFeeFor(teamSelect.value, members);
  } else {
    document.getElementById("u-fornamn").value = member.fornamn;
    document.getElementById("u-efternamn").value = member.efternamn;
    document.getElementById("u-fodelsear").value = member.fodelsear;
    document.getElementById("u-kon").value = member.kon;
    document.getElementById("u-epost").value = member.epost;
    teamSelect.value = member.lag;
    document.getElementById("u-vardnadshavare").value =
      member.vardnadshavare === undefined ? "" : member.vardnadshavare;
    document.getElementById("u-avgift").value = member.arsavgift.belopp_eur;
    document.getElementById("u-betald").checked = member.arsavgift.betald === true;
  }

  document.getElementById("admin-user-form-error").hidden = true;
  document.getElementById("admin-user-form").hidden = false;
  document.getElementById("u-fornamn").focus();
}

function closeUserForm() {
  const form = document.getElementById("admin-user-form");
  if (form !== null) {
    form.hidden = true;
  }
  editingUserNumber = null;
}

function showUserFormError(text) {
  const box = document.getElementById("admin-user-form-error");
  box.textContent = text;
  box.hidden = false;
}

// Sparar formuläret: skapar en ny medlem eller ändrar en befintlig
async function saveUser(event) {
  event.preventDefault();

  // Bara administratören får skapa eller ändra användare
  if (isAdmin() === false) {
    return;
  }

  const fornamn = document.getElementById("u-fornamn").value.trim();
  const efternamn = document.getElementById("u-efternamn").value.trim();
  const fodelsear = Number(document.getElementById("u-fodelsear").value);
  const kon = document.getElementById("u-kon").value;
  const epost = document.getElementById("u-epost").value.trim();
  const lag = document.getElementById("u-lag").value;
  const avgift = Number(document.getElementById("u-avgift").value);
  const vardnadshavare = document.getElementById("u-vardnadshavare").value.trim();
  const betald = document.getElementById("u-betald").checked;

  // Kontrollera det som skrivits in
  if (fornamn === "" || efternamn === "") {
    showUserFormError("Fyll i förnamn och efternamn.");
    return;
  }
  if (Number.isInteger(fodelsear) === false || fodelsear < 1930 || fodelsear > 2027) {
    showUserFormError("Födelseåret måste vara ett år mellan 1930 och 2027.");
    return;
  }
  if (epost.indexOf("@") === -1) {
    showUserFormError("Skriv en giltig e-postadress.");
    return;
  }
  if (lag === "") {
    showUserFormError("Välj ett lag.");
    return;
  }
  if (isNaN(avgift) || avgift < 0) {
    showUserFormError("Årsavgiften kan inte vara negativ.");
    return;
  }

  try {
    const members = await loadMembers(); // själva listan med medlemmar
    let target = null;

    if (editingUserNumber === null) {
      // ---- Skapa ny medlem ----
      target = {
        medlemsnummer: nextMemberNumber(members),
        fornamn: fornamn,
        efternamn: efternamn,
        fodelsear: fodelsear,
        kon: kon,
        lag: lag,
        medlem_sedan: 2027,
        epost: epost,
        arsavgift: { ar: 2027, belopp_eur: avgift, betald: false, betaldatum: null, betalningssatt: null }
      };
      members.push(target);

    } else {
      // ---- Redigera befintlig medlem ----
      for (let i = 0; i < members.length; i++) {
        if (members[i].medlemsnummer === editingUserNumber) {
          target = members[i];
        }
      }
      if (target === null) {
        showUserFormError("Medlemmen hittades inte.");
        return;
      }
      target.fornamn = fornamn;
      target.efternamn = efternamn;
      target.fodelsear = fodelsear;
      target.kon = kon;
      target.epost = epost;
      target.lag = lag;
      target.arsavgift.belopp_eur = avgift;
    }

    // Vårdnadshavare finns bara för vissa medlemmar (barn)
    if (vardnadshavare === "") {
      delete target.vardnadshavare;
    } else {
      target.vardnadshavare = vardnadshavare;
    }

    // Årsavgiftens betalstatus
    if (betald && target.arsavgift.betald !== true) {
      target.arsavgift.betald = true;
      target.arsavgift.betaldatum = todayISO();
      target.arsavgift.betalningssatt = "Markerad av admin";
    } else if (betald === false) {
      target.arsavgift.betald = false;
      target.arsavgift.betaldatum = null;
      target.arsavgift.betalningssatt = null;
    }

    closeUserForm();
    await refreshAdminView();

  } catch (error) {
    showUserFormError("Kunde inte spara: " + error.message);
  }
}

// Tar bort en medlem (efter att administratören har bekräftat)
async function deleteUser(member) {
  if (isAdmin() === false || member === null) {
    return;
  }

  const sure = confirm(
    "Ta bort " + member.fornamn + " " + member.efternamn + " (" + member.medlemsnummer +
    ")? Medlemmen tas också bort från alla anmälningar."
  );
  if (sure === false) {
    return;
  }

  const members = await loadMembers();
  const index = members.indexOf(member);
  if (index !== -1) {
    members.splice(index, 1);
  }

  // Ta bort medlemmen från anmälningar och betalningar i alla aktiviteter
  const activities = await loadActivities();
  for (let i = 0; i < activities.length; i++) {
    if (Array.isArray(activities[i].deltagare)) {
      const pos = activities[i].deltagare.indexOf(member.medlemsnummer);
      if (pos !== -1) {
        activities[i].deltagare.splice(pos, 1);
        activities[i].antal_anmälda = activities[i].deltagare.length;
      }
    }
    if (Array.isArray(activities[i].betalda)) {
      const pos = activities[i].betalda.indexOf(member.medlemsnummer);
      if (pos !== -1) {
        activities[i].betalda.splice(pos, 1);
      }
    }
  }

  closeUserForm();
  await refreshAdminView();
}

// Visar listan med medlemmar (med sökning)
async function renderAdminUsers() {
  const box = document.getElementById("admin-users");
  if (box === null) {
    return;
  }

  try {
    const members = await getAllMembers();
    const search = userSearchText.trim().toLowerCase();

    const matches = [];
    for (let i = 0; i < members.length; i++) {
      const text = (members[i].fornamn + " " + members[i].efternamn + " " +
        members[i].medlemsnummer + " " + members[i].lag).toLowerCase();
      if (search === "" || text.includes(search)) {
        matches.push(members[i]);
      }
    }

    box.replaceChildren();

    if (matches.length === 0) {
      box.textContent = "Inga medlemmar hittades.";
      return;
    }

    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    const table = document.createElement("table");
    table.className = "data";

    const headRow = table.createTHead().insertRow();
    const headings = ["Namn", "Medlemsnummer", "Lag", ""];
    for (let i = 0; i < headings.length; i++) {
      const th = document.createElement("th");
      th.textContent = headings[i];
      headRow.append(th);
    }

    const tbody = table.createTBody();
    for (let i = 0; i < matches.length && i < USER_ROWS; i++) {
      const member = matches[i];
      const row = tbody.insertRow();
      row.insertCell().textContent = member.fornamn + " " + member.efternamn;
      row.insertCell().textContent = member.medlemsnummer;
      row.insertCell().textContent = member.lag;

      const actions = row.insertCell();
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "btn-ghost";
      editButton.textContent = "Redigera";
      editButton.addEventListener("click", function () {
        openUserForm(member);
      });
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "btn-ghost btn-danger";
      deleteButton.textContent = "Ta bort";
      deleteButton.addEventListener("click", function () {
        deleteUser(member);
      });
      actions.append(editButton, deleteButton);
    }
    wrap.append(table);
    box.append(wrap);

    const note = document.createElement("p");
    note.className = "muted";
    note.textContent = "Visar " + Math.min(matches.length, USER_ROWS) + " av " +
      matches.length + " medlemmar" + (matches.length > USER_ROWS ? ". Sök för att hitta fler." : ".");
    box.append(note);

  } catch (error) {
    box.textContent = "Kunde inte läsa medlemmarna: " + error.message;
  }
}

/* ---------- 5. Lag: skapa, redigera, ta bort ---------- */

// Vilket lag som redigeras (tränarens id). null = nytt lag.
let editingTeamId = null;

// Nästa lediga tränar-id, till exempel "TR-17"
function nextCoachId(coaches) {
  let highest = 0;
  for (let i = 0; i < coaches.length; i++) {
    const n = Number(coaches[i].tranare_id.replace("TR-", ""));
    if (n > highest) {
      highest = n;
    }
  }
  return "TR-" + String(highest + 1).padStart(2, "0");
}

// Visar formuläret. coach = null ger ett tomt formulär (nytt lag).
function openTeamForm(coach) {
  if (isAdmin() === false) {
    return;
  }

  editingTeamId = (coach === null) ? null : coach.tranare_id;
  document.getElementById("admin-team-form-title").textContent =
    (coach === null) ? "Nytt lag" : "Redigera lag";
  document.getElementById("t-lag").value = (coach === null) ? "" : coach.lag;
  document.getElementById("t-tranare").value = (coach === null) ? "" : coach.namn;

  document.getElementById("admin-team-message").hidden = true;
  document.getElementById("admin-team-form-error").hidden = true;
  document.getElementById("admin-team-form").hidden = false;
  document.getElementById("t-lag").focus();
}

function closeTeamForm() {
  const form = document.getElementById("admin-team-form");
  if (form !== null) {
    form.hidden = true;
  }
  editingTeamId = null;
}

function showTeamFormError(text) {
  const box = document.getElementById("admin-team-form-error");
  box.textContent = text;
  box.hidden = false;
}

// Sparar formuläret: skapar ett nytt lag eller ändrar ett befintligt
async function saveTeam(event) {
  event.preventDefault();

  // Bara administratören får skapa eller ändra lag
  if (isAdmin() === false) {
    return;
  }

  const lag = document.getElementById("t-lag").value.trim();
  const tranare = document.getElementById("t-tranare").value.trim();

  if (lag === "" || tranare === "") {
    showTeamFormError("Fyll i lagets namn och tränarens namn.");
    return;
  }

  try {
    const schedule = await loadSchedule();
    const coaches = schedule.tranare;

    // Två lag får inte heta lika
    for (let i = 0; i < coaches.length; i++) {
      if (coaches[i].lag.toLowerCase() === lag.toLowerCase() &&
          coaches[i].tranare_id !== editingTeamId) {
        showTeamFormError("Det finns redan ett lag som heter " + coaches[i].lag + ".");
        return;
      }
    }

    if (editingTeamId === null) {
      // ---- Skapa nytt lag ----
      coaches.push({ tranare_id: nextCoachId(coaches), namn: tranare, lag: lag });

    } else {
      // ---- Redigera befintligt lag ----
      let coach = null;
      for (let i = 0; i < coaches.length; i++) {
        if (coaches[i].tranare_id === editingTeamId) {
          coach = coaches[i];
        }
      }
      if (coach === null) {
        showTeamFormError("Laget hittades inte.");
        return;
      }

      const oldName = coach.lag;
      const members = await loadMembers();
      const activities = schedule.aktiviteter;

      // Byter laget namn ändras namnet överallt där det används
      if (oldName !== lag) {
        for (let i = 0; i < members.length; i++) {
          if (members[i].lag === oldName) {
            members[i].lag = lag;
          }
        }
        for (let i = 0; i < activities.length; i++) {
          if (isEvent(activities[i]) === false && activities[i].namn === oldName) {
            activities[i].namn = lag;
          }
        }
      }

      // Byter tränaren namn ändras namnet i hens aktiviteter
      if (coach.namn !== tranare) {
        for (let i = 0; i < activities.length; i++) {
          if (activities[i].tranare_id === coach.tranare_id) {
            activities[i].tranare_namn = tranare;
          }
        }
      }

      coach.lag = lag;
      coach.namn = tranare;
    }

    closeTeamForm();
    await refreshAdminView();

  } catch (error) {
    showTeamFormError("Kunde inte spara: " + error.message);
  }
}

// Tar bort ett lag (bara om det inte har några medlemmar eller evenemang)
async function deleteTeam(coach) {
  if (isAdmin() === false || coach === null) {
    return;
  }

  const message = document.getElementById("admin-team-message");
  message.hidden = true;

  const schedule = await loadSchedule();
  const members = await getAllMembers();
  const activities = schedule.aktiviteter;

  let memberCount = 0;
  for (let i = 0; i < members.length; i++) {
    if (members[i].lag === coach.lag) {
      memberCount++;
    }
  }
  let eventCount = 0;
  let trainingCount = 0;
  for (let i = 0; i < activities.length; i++) {
    if (activities[i].tranare_id === coach.tranare_id && isEvent(activities[i])) {
      eventCount++;
    }
    if (activities[i].namn === coach.lag && isEvent(activities[i]) === false) {
      trainingCount++;
    }
  }

  if (memberCount > 0) {
    message.textContent = "Laget " + coach.lag + " har " + memberCount +
      " medlemmar. Flytta eller ta bort dem först.";
    message.hidden = false;
    return;
  }
  if (eventCount > 0) {
    message.textContent = "Tränaren har " + eventCount +
      " evenemang. Ta bort eller flytta dem först.";
    message.hidden = false;
    return;
  }

  const sure = confirm(
    'Ta bort laget "' + coach.lag + '"? Lagets ' + trainingCount + " träningar tas också bort."
  );
  if (sure === false) {
    return;
  }

  // Ta bort lagets träningar
  for (let i = activities.length - 1; i >= 0; i--) {
    if (activities[i].namn === coach.lag && isEvent(activities[i]) === false) {
      activities.splice(i, 1);
    }
  }
  // Ta bort laget (tränarposten)
  const index = schedule.tranare.indexOf(coach);
  if (index !== -1) {
    schedule.tranare.splice(index, 1);
  }

  closeTeamForm();
  await refreshAdminView();
}

// Visar tabellen med lag
async function renderAdminTeams() {
  const box = document.getElementById("admin-teams");
  if (box === null) {
    return;
  }

  try {
    const schedule = await loadSchedule();
    const members = await getAllMembers();
    const coaches = schedule.tranare;
    const activities = schedule.aktiviteter;

    box.replaceChildren();

    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    const table = document.createElement("table");
    table.className = "data";

    const headRow = table.createTHead().insertRow();
    const headings = ["Lag", "Tränare", "Medlemmar", "Träningar", ""];
    for (let i = 0; i < headings.length; i++) {
      const th = document.createElement("th");
      th.textContent = headings[i];
      headRow.append(th);
    }

    const tbody = table.createTBody();
    for (let i = 0; i < coaches.length; i++) {
      const coach = coaches[i];

      let memberCount = 0;
      for (let j = 0; j < members.length; j++) {
        if (members[j].lag === coach.lag) {
          memberCount++;
        }
      }
      let trainingCount = 0;
      for (let j = 0; j < activities.length; j++) {
        if (activities[j].namn === coach.lag && isEvent(activities[j]) === false) {
          trainingCount++;
        }
      }

      const row = tbody.insertRow();
      row.insertCell().textContent = coach.lag;
      row.insertCell().textContent = coach.namn + " (" + coach.tranare_id + ")";
      row.insertCell().textContent = memberCount;
      row.insertCell().textContent = trainingCount;

      const actions = row.insertCell();
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "btn-ghost";
      editButton.textContent = "Redigera";
      editButton.addEventListener("click", function () {
        openTeamForm(coach);
      });
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "btn-ghost btn-danger";
      deleteButton.textContent = "Ta bort";
      deleteButton.addEventListener("click", function () {
        deleteTeam(coach);
      });
      actions.append(editButton, deleteButton);
    }

    wrap.append(table);
    box.append(wrap);

  } catch (error) {
    box.textContent = "Kunde inte läsa lagen: " + error.message;
  }
}

// Ritar om alla delar av adminvyn (efter att något har ändrats)
async function refreshAdminView() {
  // Behåll den valda aktiviteten om den finns kvar
  if (currentActivity !== null) {
    pendingSelectId = currentActivity.id;
  }
  adminMenuIsFilled = false;
  await renderAdminActivity();
  await renderAdminUsers();
  await renderAdminTeams();
  await renderAdminMembers();
}

/* ---------- Startpunkt: anropas av scripts.js ---------- */

// Tömmer adminvyn, så att inget ligger kvar i sidan när någon som inte
// är administratör loggar in
function clearAdminView() {
  const ids = ["admin-activities", "admin-users", "admin-teams", "admin-members"];
  for (let i = 0; i < ids.length; i++) {
    const box = document.getElementById(ids[i]);
    if (box !== null) {
      box.replaceChildren();
    }
  }
  const select = document.getElementById("admin-activity-select");
  if (select !== null) {
    select.replaceChildren();
  }
  adminMenuIsFilled = false;
  currentActivity = null;
  closeEventForm();
  closeUserForm();
  closeTeamForm();
}

async function renderAdminView() {
  // Kontrollera att användaren är administratör
  if (isAdmin() === false) {
    clearAdminView();
    return;
  }
  if (document.getElementById("admin") === null) {
    return;
  }

  ensureActivityCard();
  ensureManageCards();
  await renderAdminActivity();
  await renderAdminUsers();
  await renderAdminTeams();
  await renderAdminMembers();
}
