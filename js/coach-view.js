"use strict";

/* ------------------------------------------------------------------
   coach-view.js: tränarens sida ("Mina evenemang")

   Visar den inloggade tränarens egna kommande träningar.
   Filtreringen görs med tränarens id:
   - getCoachId() i roles.js ger id:t, till exempel "TR-02"
   - getUpcomingActivitiesByCoach() i activities.js hämtar träningarna
------------------------------------------------------------------- */

// Hur många träningar som visas i tabellen
const COACH_ROWS = 20;

// Lägger till en cell med text i en tabellrad
function addCell(row, text) {
  const cell = row.insertCell();
  cell.textContent = text;
}

// Ritar upp hela tränarsidan
async function renderCoachView() {
  const view = document.getElementById("mina-evenemang");

  // Gör ingenting om sidan saknas eller om användaren inte är tränare
  if (view === null || isCoach() === false) {
    return;
  }

  const message = document.getElementById("coach-message");
  const body = document.getElementById("coach-body");

  try {
    const coachId = getCoachId();
    if (coachId === null) {
      message.textContent = "Tränar-id saknas. Logga ut och logga in igen.";
      message.hidden = false;
      return;
    }

    // Hämta tränaren och tränarens kommande träningar
    const coach = await getCoachById(coachId);
    const list = await getUpcomingActivitiesByCoach(coachId);
    message.hidden = true;

    // Raden med tränarens namn, id och lag
    const info = document.getElementById("coach-info");
    if (coach !== null) {
      info.textContent = "Tränare: " + coach.namn + " (" + coach.tranare_id + "), lag: " + coach.lag;
    } else {
      info.textContent = "Tränare " + coachId;
    }

    body.replaceChildren(); // töm rutan först
    if (list.length === 0) {
      body.textContent = "Inga kommande träningar.";
      return;
    }

    // Bygg tabellen
    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    const table = document.createElement("table");
    table.className = "data";

    // Rubrikraden
    const headRow = table.createTHead().insertRow();
    const headings = ["När", "Plats", "Anmälda"];
    for (let i = 0; i < headings.length; i++) {
      const th = document.createElement("th");
      th.textContent = headings[i];
      headRow.append(th);
    }

    // En rad per träning (som mest COACH_ROWS stycken)
    const tbody = table.createTBody();
    for (let i = 0; i < list.length && i < COACH_ROWS; i++) {
      const a = list[i];
      const row = tbody.insertRow();
      addCell(row, a.veckodag.slice(0, 3) + " " + formatDate(a.datum) + " kl. " + a.tid);
      addCell(row, a.plats);
      addCell(row, a["antal_anmälda"] + " av " + a.max_deltagare);
    }

    wrap.append(table);
    body.append(wrap);

    // Finns det fler träningar än vi visar? Berätta det.
    if (list.length > COACH_ROWS) {
      const note = document.createElement("p");
      note.className = "muted";
      note.textContent = "Visar de " + COACH_ROWS + " första av " + list.length + " kommande träningar.";
      body.append(note);
    }

  } catch (error) {
    message.textContent = "Kunde inte läsa träningsschemat: " + error.message;
    message.hidden = false;
  }
}
