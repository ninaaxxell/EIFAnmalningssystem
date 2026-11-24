"use strict";

/* ------------------------------------------------------------------
   members.js: läser in medlemsregistret och har funktioner för
   att hämta medlemmar och kolla om årsavgiften är betald.

   JSON-filen ska ligga i mappen data/ bredvid index.html.
   En medlem i filen ser ut så här:
   {
     "medlemsnummer": "EIF-1001",
     "fornamn": "Johan",
     "efternamn": "Nyman",
     "lag": "EIF Fotboll - Herrlaget",
     "arsavgift": { "ar": 2027, "belopp_eur": 220, "betald": true }
   }

   OBS: funktionerna här är "async". Det betyder att de behöver lite
   tid på sig (filen ska hämtas). När du anropar dem skriver du
   "await" framför, eller ".then(...)" efter. Exempel:
     const medlem = await getMemberById("EIF-1001");
------------------------------------------------------------------- */

// Var JSON-filen finns
const MEMBERS_URL = "data/eif_medlemsregister_2027.json";

// Här sparar vi medlemmarna när de har lästs in en gång,
// så att filen inte behöver hämtas om och om igen.
let membersCache = null;

/* ---------- Läser in medlemmarna från JSON-filen ---------- */
async function loadMembers() {
  // Har vi redan läst in dem? Då använder vi de vi redan har.
  if (membersCache !== null) {
    return membersCache;
  }

  // Hämta filen (await = vänta tills den är hämtad)
  const response = await fetch(MEMBERS_URL);
  if (response.ok === false) {
    throw new Error("Kunde inte läsa " + MEMBERS_URL + " (status " + response.status + ")");
  }

  // Gör om innehållet i filen till ett JavaScript-objekt
  const data = await response.json();

  // I filen finns listan med alla medlemmar under namnet "medlemmar"
  membersCache = data.medlemmar;
  return membersCache;
}

/* ---------- 1. Hämta alla medlemmar ---------- */
async function getAllMembers() {
  const members = await loadMembers();
  // slice() gör en kopia, så vi ändrar inte originallistan av misstag
  return members.slice();
}

/* ---------- 2. Hämta en medlem via id (medlemsnummer) ---------- */
// Du kan skriva "EIF-1001", "eif-1001" eller bara 1001.
// Ger medlemmen, eller null om ingen medlem har det numret.
async function getMemberById(id) {
  const members = await loadMembers();
  const wanted = normalizeMemberId(id);

  // Gå igenom alla medlemmar en i taget
  for (let i = 0; i < members.length; i++) {
    if (members[i].medlemsnummer === wanted) {
      return members[i];
    }
  }
  return null; // ingen hittades
}

// Gör om olika sätt att skriva id:t till formatet "EIF-1001"
function normalizeMemberId(id) {
  let text = String(id).trim().toUpperCase();

  // Är det bara siffror (till exempel "1001") lägger vi till "EIF-" framför
  if (text !== "" && isNaN(text) === false) {
    text = "EIF-" + text;
  }
  return text;
}

/* ---------- 3. Har medlemmen betalat årsavgiften? ---------- */
// Ger true eller false. En medlem som inte finns räknas som obetald.
async function hasPaidAnnualFee(id) {
  const member = await getMemberById(id);

  if (member === null || member.arsavgift === undefined) {
    return false;
  }
  return member.arsavgift.betald === true;
}

/* ------------------------------------------------------------------
   Testa i webbläsarens konsol (tryck F12):

   getAllMembers().then(console.log);
   getMemberById("EIF-1001").then(console.log);
   hasPaidAnnualFee("EIF-1001").then(console.log);   // true
   hasPaidAnnualFee("EIF-1011").then(console.log);   // false
------------------------------------------------------------------- */
