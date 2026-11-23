"use strict";

/* ------------------------------------------------------------------
   admin.js: administratörens sida ("Administration")

   Visar:
   1. Aktiviteter och anmälningar: välj en aktivitet och se vilka som
      är anmälda och om de har betalat.
      - Träning: betald om medlemmens årsavgift är betald (automatiskt).
      - Evenemang: administratören markerar varje anmälan som betald
        med en knapp. Raden blir då grön.
   2. Medlemmar och årsavgift: alla medlemmar, grön = betald, röd = obetald.

   Använder funktioner från de andra filerna:
   - roles.js:       isAdmin()
   - members.js:     getAllMembers(), hasPaidAnnualFee()
   - activities.js:  getAllActivities()
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

// Håller reda på om rullgardinsmenyn redan är ifylld
let adminMenuIsFilled = false;

/* ---------- Hjälpfunktioner ---------- */

// Är aktiviteten ett evenemang? (annars är den en träning)
function isEvent(activity) {
  return activity.kategori === EVENT_CATEGORY;
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
    '<div id="admin-activities"></div>';

  // Lägg rutan först i adminvyn, före listan med medlemmar
  adminView.insertBefore(card, adminView.querySelector("article"));
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

    // Fyll rullgardinsmenyn första gången
    if (adminMenuIsFilled === false) {
      for (let i = 0; i < all.length; i++) {
        const option = document.createElement("option");
        option.value = all[i].id;
        option.textContent = activityLabel(all[i]);
        select.append(option);
      }
      select.addEventListener("change", renderAdminActivity);
      adminMenuIsFilled = true;
    }

    // Den aktivitet som är vald i menyn
    let activity = all[0];
    for (let i = 0; i < all.length; i++) {
      if (String(all[i].id) === select.value) {
        activity = all[i];
      }
    }

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
      " av " + activity.max_deltagare + ". Betalda: " + paidCount + ".";
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

/* ---------- 2. Medlemmar och årsavgift ---------- */

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
