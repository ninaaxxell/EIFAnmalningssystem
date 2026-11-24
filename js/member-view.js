"use strict";

/* ------------------------------------------------------------------
   member-view.js: medlemmens sida ("Min sida")

   Visar den inloggade medlemmens egna uppgifter och information om
   årsavgiften. Använder funktioner från members.js och roles.js.

   I index.html finns två tomma platser som andra i gruppen kan fylla:
     #member-activities     aktiviteter
     #member-registrations  medlemmens egna anmälningar
   Medlemmens medlemsnummer får man med: getCurrentUser().memberId
------------------------------------------------------------------- */

// Gör om ett datum som "2027-03-26" till "26.3.2027"
function formatDate(isoDate) {
  if (!isoDate) {
    return "–"; // inget datum finns
  }
  const parts = isoDate.split("-"); // ["2027", "03", "26"]
  if (parts.length !== 3) {
    return isoDate;
  }
  // Number() tar bort nollan framför, så "03" blir 3
  return Number(parts[2]) + "." + Number(parts[1]) + "." + parts[0];
}

// Fyller en lista (<dl>) i HTML-sidan med rader.
// Varje rad är en lista med två saker: [rubrik, värde]
function fillDetails(listId, rows) {
  const list = document.getElementById(listId);
  list.replaceChildren(); // töm listan först

  for (let i = 0; i < rows.length; i++) {
    const dt = document.createElement("dt"); // rubriken
    dt.textContent = rows[i][0];

    const dd = document.createElement("dd"); // värdet
    dd.textContent = rows[i][1];

    list.append(dt, dd);
  }
}

// Ritar upp hela medlemssidan
async function renderMemberView() {
  const view = document.getElementById("min-sida");

  // Gör ingenting om sidan saknas eller om användaren inte är medlem
  if (view === null || isMember() === false) {
    return;
  }

  const message = document.getElementById("member-message");
  const user = getCurrentUser();

  try {
    // Hämta medlemmen ur registret med hjälp av medlemsnumret
    const member = await getMemberById(user.memberId);

    if (member === null) {
      message.textContent = "Dina medlemsuppgifter hittades inte i registret.";
      message.hidden = false;
      return;
    }
    message.hidden = true;

    // Visa medlemmens riktiga namn uppe i headern
    document.getElementById("user-name").textContent =
      member.fornamn + " " + member.efternamn;

    // ---- Rutan "Mina uppgifter" ----
    const details = [
      ["Namn", member.fornamn + " " + member.efternamn],
      ["Medlemsnummer", member.medlemsnummer],
      ["Lag", member.lag],
      ["Födelseår", member.fodelsear],
      ["E-post", member.epost],
      ["Medlem sedan", member.medlem_sedan]
    ];
    // Vårdnadshavare finns bara för vissa medlemmar (barn)
    if (member.vardnadshavare) {
      details.push(["Vårdnadshavare", member.vardnadshavare]);
    }
    fillDetails("member-details", details);

    // ---- Rutan "Årsavgift" ----
    const fee = member.arsavgift;
    const paid = await hasPaidAnnualFee(member.medlemsnummer);

    // Märket "Betald" eller "Obetald"
    const badge = document.getElementById("fee-status");
    if (paid) {
      badge.textContent = "Betald";
      badge.className = "badge badge-paid";
    } else {
      badge.textContent = "Obetald";
      badge.className = "badge badge-unpaid";
    }

    const feeRows = [
      ["Avgiftsår", fee.ar],
      ["Belopp", fee.belopp_eur + " €"]
    ];
    // Betaldatum och betalningssätt visas bara om avgiften är betald
    if (paid) {
      feeRows.push(["Betaldatum", formatDate(fee.betaldatum)]);
      feeRows.push(["Betalningssätt", fee.betalningssatt]);
    }
    fillDetails("fee-details", feeRows);

    // Förklarande text under avgiften
    const note = document.getElementById("fee-note");
    if (paid) {
      note.textContent = "Tack! Årsavgiften är betald, så dina träningar räknas som betalda.";
    } else {
      note.textContent = "Årsavgiften är inte betald. Träningar räknas som betalda först när årsavgiften är betald.";
    }

  } catch (error) {
    // Om något går fel (till exempel att filen inte hittas) visar vi ett felmeddelande
    message.textContent = "Kunde inte läsa medlemsregistret: " + error.message;
    message.hidden = false;
  }
}
