"use strict";

/* ------------------------------------------------------------------
   activities.js: läser in träningsschemat och har funktioner för
   att hämta aktiviteter och tränare. Fungerar som members.js.

   JSON-filen ska ligga i mappen data/ bredvid index.html.
   En aktivitet i filen ser ut så här:
   {
     "id": 1,
     "namn": "EIF Fotboll - P7",
     "datum": "2027-01-04",
     "veckodag": "Måndag",
     "tid": "17:00",
     "plats": "EIF-hallen, Västerby",
     "tranare_id": "TR-02",
     "tranare_namn": "Sofia Berglund",
     "max_deltagare": 18,
     "antal_anmälda": 10
   }
   Tränarna finns också som en egen lista, "tranare", överst i filen:
   { "tranare_id": "TR-02", "namn": "Sofia Berglund", "lag": "EIF Fotboll - P7" }

   OBS: funktionerna är "async", så använd "await" eller ".then(...)".
------------------------------------------------------------------- */

// Var JSON-filen finns
const ACTIVITIES_URL = "data/eif_traningsschema_vinter_var_2027.json";

// Vill du testa med ett annat "idag"? Skriv till exempel "2027-01-01" här.
// Lämna null för att använda datorns riktiga datum.
const DEMO_TODAY = null;

// Här sparar vi schemat när det har lästs in en gång
let scheduleCache = null;

/* ---------- Läser in schemat från JSON-filen ---------- */
async function loadSchedule() {
  if (scheduleCache !== null) {
    return scheduleCache;
  }

  const response = await fetch(ACTIVITIES_URL);
  if (response.ok === false) {
    throw new Error("Kunde inte läsa " + ACTIVITIES_URL + " (status " + response.status + ")");
  }

  scheduleCache = await response.json();
  return scheduleCache;
}

// Dagens datum som text, till exempel "2027-01-04"
function todayISO() {
  if (DEMO_TODAY !== null) {
    return DEMO_TODAY;
  }
  return new Date().toLocaleDateString("sv-SE");
}

/* ---------- Aktiviteter ---------- */

// Alla aktiviteter i schemat
async function getAllActivities() {
  const schedule = await loadSchedule();
  return schedule.aktiviteter.slice(); // en kopia av listan
}

// En aktivitet via id. Ger null om den inte finns.
async function getActivityById(id) {
  const all = await getAllActivities();

  for (let i = 0; i < all.length; i++) {
    if (all[i].id === Number(id)) {
      return all[i];
    }
  }
  return null;
}

// Bara kommande aktiviteter (gamla visas inte), med den närmaste först
async function getUpcomingActivities() {
  const all = await getAllActivities();
  const upcoming = [];

  for (let i = 0; i < all.length; i++) {
    // Datumen är skrivna som "2027-01-04", så vi kan jämföra dem som text
    if (all[i].datum >= todayISO()) {
      upcoming.push(all[i]);
    }
  }

  // Sortera efter datum och tid. Funktionen säger vilken som ska komma först.
  upcoming.sort(function (a, b) {
    return (a.datum + a.tid).localeCompare(b.datum + b.tid);
  });
  return upcoming;
}

/* ---------- Tränare ---------- */

// Alla tränare
async function getAllCoaches() {
  const schedule = await loadSchedule();
  return schedule.tranare.slice();
}

// En tränare via id, till exempel getCoachById("TR-02"). Ger null om ingen finns.
async function getCoachById(tranareId) {
  const coaches = await getAllCoaches();

  for (let i = 0; i < coaches.length; i++) {
    if (coaches[i].tranare_id === tranareId) {
      return coaches[i];
    }
  }
  return null;
}

// Alla aktiviteter som en tränare ansvarar för
async function getActivitiesByCoach(tranareId) {
  const all = await getAllActivities();
  const result = [];

  for (let i = 0; i < all.length; i++) {
    if (all[i].tranare_id === tranareId) {
      result.push(all[i]);
    }
  }
  return result;
}

// Bara kommande aktiviteter som en tränare ansvarar för
async function getUpcomingActivitiesByCoach(tranareId) {
  const upcoming = await getUpcomingActivities();
  const result = [];

  for (let i = 0; i < upcoming.length; i++) {
    if (upcoming[i].tranare_id === tranareId) {
      result.push(upcoming[i]);
    }
  }
  return result;
}

/* ------------------------------------------------------------------
   Testa i webbläsarens konsol (tryck F12):

   getAllActivities().then(console.log);
   getCoachById("TR-02").then(console.log);
   getUpcomingActivitiesByCoach("TR-02").then(console.log);
------------------------------------------------------------------- */
