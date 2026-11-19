"use strict";

/* ------------------------------------------------------------------
   member-view.js: medlemsvyn ("Min sida").

   Visar den inloggade medlemmens egna uppgifter och information om
   årsavgiften. Använder funktionerna i members.js och roles.js.

   Platser för de andra i gruppen (finns i index.html):
     #member-activities     aktiviteter i medlemsvyn (Fanny)
     #member-registrations  medlemmens egna anmälningar (Christian)
   Den inloggade medlemmens medlemsnummer får man med:
     getCurrentUser().memberId
------------------------------------------------------------------- */

// Gör om "2027-03-26" till "26.3.2027"
function formatDate(isoDate) {
  if (!isoDate) return "–";
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  return Number(parts[2]) + "." + Number(parts[1]) + "." + parts[0];
}

// Fyller en <dl>-lista med rader av typen [etikett, värde]
function fillDetails(listId, rows) {
  const list = document.getElementById(listId);
  list.replaceChildren();
  rows.forEach(([label, value]) => {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    list.append(dt, dd);
  });
}

async function renderMemberView() {
  const view = document.getElementById("min-sida");
  if (!view || !isMember()) return;

  const message = document.getElementById("member-message");
  const user = getCurrentUser();

  try {
    const member = await getMemberById(user.memberId);

    if (!member) {
      message.textContent = "Dina medlemsuppgifter hittades inte i registret.";
      message.hidden = false;
      return;
    }
    message.hidden = true;

    // Visa medlemmens riktiga namn i headern
    document.getElementById("user-name").textContent =
      member.fornamn + " " + member.efternamn;

    // ---- Mina uppgifter ----
    fillDetails("member-details", [
      ["Namn", member.fornamn + " " + member.efternamn],
      ["Medlemsnummer", member.medlemsnummer],
      ["Lag", member.lag],
      ["Födelseår", member.fodelsear],
      ["E-post", member.epost],
      ["Medlem sedan", member.medlem_sedan],
      ...(member.vardnadshavare ? [["Vårdnadshavare", member.vardnadshavare]] : [])
    ]);

    // ---- Årsavgift ----
    const fee = member.arsavgift;
    const paid = await hasPaidAnnualFee(member.medlemsnummer);

    const badge = document.getElementById("fee-status");
    badge.textContent = paid ? "Betald" : "Obetald";
    badge.className = "badge " + (paid ? "badge-paid" : "badge-unpaid");

    const rows = [
      ["Avgiftsår", fee.ar],
      ["Belopp", fee.belopp_eur + " €"]
    ];
    if (paid) {
      rows.push(["Betaldatum", formatDate(fee.betaldatum)]);
      rows.push(["Betalningssätt", fee.betalningssatt]);
    }
    fillDetails("fee-details", rows);

    document.getElementById("fee-note").textContent = paid
      ? "Tack! Årsavgiften är betald, så dina träningar räknas som betalda."
      : "Årsavgiften är inte betald. Träningar räknas som betalda först när årsavgiften är betald.";

  } catch (error) {
    message.textContent = "Kunde inte läsa medlemsregistret: " + error.message;
    message.hidden = false;
  }
}
