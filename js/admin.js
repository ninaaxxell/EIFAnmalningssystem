
"use strict";

/* Administratörens vy */

async function renderAdminView() {
  // Kontrollera att användaren är administratör
  if (!isAdmin()) return;

  const adminView = document.getElementById("admin");
  const memberList = document.getElementById("admin-members");

  if (!adminView || !memberList) return;

  try {
    // Hämta alla medlemmar
    const members = await getAllMembers();

    memberList.innerHTML = "";

    for (const member of members) {
      // Kontrollera årsavgiften
      const paid = await hasPaidAnnualFee(member.medlemsnummer);

      const row = document.createElement("p");

      row.textContent =
        `${member.fornamn} ${member.efternamn} – Årsavgift: ` +
        (paid ? "Betald" : "Obetald");

      // Färgmarkering
      row.className = paid ? "paid" : "unpaid";

      memberList.appendChild(row);
    }

  } catch (error) {
    console.error("Fel vid hämtning av medlemmar:", error);
    memberList.textContent =
      "Kunde inte läsa medlemsregistret.";
  }
}