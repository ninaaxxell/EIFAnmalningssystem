"use strict";

/* ------------------------------------------------------------------
   members.js: läser in medlemsregistret (JSON) och har funktioner
   för att hämta medlemmar och kontrollera årsavgiften.

   Filen ska ligga i mappen data/ bredvid index.html.
   Varje medlem i JSON-filen ser ut så här:
   {
     "medlemsnummer": "EIF-1001",
     "fornamn": "Johan", "efternamn": "Nyman",
     "lag": "EIF Fotboll - Herrlaget",
     "arsavgift": { "ar": 2027, "belopp_eur": 220, "betald": true, ... }
   }
------------------------------------------------------------------- */
const MEMBERS_URL = "data/eif_medlemsregister_2027.json";

// Medlemmarna läses in en gång och sparas här, så filen inte hämtas om och om igen
let membersCache = null;

/* ---------- Läser in medlemmarna från JSON-filen ---------- */
async function loadMembers() {
  if (membersCache) return membersCache;

  const response = await fetch(MEMBERS_URL);
  if (!response.ok) {
    throw new Error("Kunde inte läsa " + MEMBERS_URL + " (status " + response.status + ")");
  }

  const data = await response.json();
  membersCache = data.medlemmar; // listan med alla medlemmar
  return membersCache;
}

/* ---------- 1. Hämta alla medlemmar ---------- */
async function getAllMembers() {
  const members = await loadMembers();
  return [...members]; // en kopia, så originalet inte ändras av misstag
}

/* ---------- 2. Hämta en viss medlem via id (medlemsnummer) ---------- */
// Tar emot "EIF-1001", "eif-1001" eller bara 1001.
// Returnerar medlemmen, eller null om ingen med det numret finns.
async function getMemberById(id) {
  const members = await loadMembers();
  const wanted = normalizeMemberId(id);
  const member = members.find(m => m.medlemsnummer === wanted);
  return member || null;
}

// Gör om olika sätt att skriva id:t till formatet "EIF-1001"
function normalizeMemberId(id) {
  const text = String(id).trim().toUpperCase();
  return /^\d+$/.test(text) ? "EIF-" + text : text;
}

/* ---------- 3. Har medlemmen betalat årsavgiften? ---------- */
// Returnerar true eller false. En okänd medlem räknas som obetald.
async function hasPaidAnnualFee(id) {
  const member = await getMemberById(id);
  if (!member || !member.arsavgift) return false;
  return member.arsavgift.betald === true;
}

/* ------------------------------------------------------------------
   Testa i webbläsarens konsol (F12):

   getAllMembers().then(console.log);
   getMemberById("EIF-1001").then(console.log);
   hasPaidAnnualFee("EIF-1001").then(console.log);   // true
   hasPaidAnnualFee("EIF-1011").then(console.log);   // false
------------------------------------------------------------------- */
