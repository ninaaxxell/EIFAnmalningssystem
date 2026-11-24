"use strict";

/* ------------------------------------------------------------------
   activities.js: träningsschemat, aktiviteter och tränare

   Den här filen är Fannys activities.js ihopslagen med funktionerna
   som tränarsidan (coach-view.js) behöver.

   Filen gör fyra saker:
   1. Läser in schemat från JSON-filen
   2. Hämtar aktiviteter (alla, kommande, via id, via tränare)
   3. Hämtar tränare (via id)
   4. Visar medlemmens aktiviteter på "Min sida"

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
   Tränarna finns också som en egen lista, "tranare", överst i filen.

   OBS: funktionerna som hämtar data är "async". Använd "await"
   framför dem, eller ".then(...)" efter.
------------------------------------------------------------------- */

// Var JSON-filen finns
const ACTIVITIES_URL = "data/eif_traningsschema_vinter_var_2027.json";

// Vill du testa med ett annat "idag"? Skriv till exempel "2027-01-01" här.
// Lämna null för att använda datorns riktiga datum.
const DEMO_TODAY = null;

// Så många aktivitetskort visas på medlemmens sida
const MEMBER_ACTIVITY_COUNT = 12;

// Här sparar vi schemat när det har lästs in en gång
let scheduleCache = null;

/* ---------- Läs in schemat ---------- */

// Läser in hela filen (aktiviteter och tränare)
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

// Läser in bara listan med aktiviteter
async function loadActivities() {
  const schedule = await loadSchedule();
  return schedule.aktiviteter;
}

// Dagens datum som text, till exempel "2027-01-04"
function todayISO() {
  if (DEMO_TODAY !== null) {
    return DEMO_TODAY;
  }
  return new Date().toLocaleDateString("sv-SE");
}

/* ---------- Hämta aktiviteter ---------- */

// Alla aktiviteter i schemat
async function getAllActivities() {
  const activities = await loadActivities();
  return activities.slice(); // en kopia av listan
}

// En aktivitet via id. Ger null om den inte finns.
async function getActivityById(id) {
  const activities = await loadActivities();

  for (let i = 0; i < activities.length; i++) {
    if (activities[i].id === Number(id)) {
      return activities[i];
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

  // Sortera efter datum och tid
  upcoming.sort(function (a, b) {
    return (a.datum + a.tid).localeCompare(b.datum + b.tid);
  });
  return upcoming;
}

/* ---------- Lediga platser ---------- */

// Antal lediga platser i en aktivitet.
// Har någon anmält sig under tiden (listan "deltagare" finns) räknar vi från den.
// Annars använder vi talet "antal_anmälda" från JSON-filen.
function getAvailableSpots(activity) {
  let registered = activity.antal_anmälda;
  if (Array.isArray(activity.deltagare)) {
    registered = activity.deltagare.length;
  }
  return activity.max_deltagare - registered;
}

// Är aktiviteten full? Ger true eller false.
function isActivityFull(activity) {
  return getAvailableSpots(activity) <= 0;
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

// Alla aktiviteter som en tränare ansvarar för (via tränarens id)
async function getActivitiesByCoach(coachId) {
  const all = await getAllActivities();
  const result = [];

  for (let i = 0; i < all.length; i++) {
    if (all[i].tranare_id === coachId) {
      result.push(all[i]);
    }
  }
  return result;
}

// Alla aktiviteter som en tränare ansvarar för (via tränarens namn)
async function getActivitiesByCoachName(coachName) {
  const all = await getAllActivities();
  const result = [];

  for (let i = 0; i < all.length; i++) {
    if (all[i].tranare_namn === coachName) {
      result.push(all[i]);
    }
  }
  return result;
}

// Bara kommande aktiviteter som en tränare ansvarar för
async function getUpcomingActivitiesByCoach(coachId) {
  const upcoming = await getUpcomingActivities();
  const result = [];

  for (let i = 0; i < upcoming.length; i++) {
    if (upcoming[i].tranare_id === coachId) {
      result.push(upcoming[i]);
    }
  }
  return result;
}

/* ---------- Visa aktiviteter på medlemmens sida ---------- */

// Visar medlemmens eget lags kommande träningar som kort.
// Tränarens sida ritas av coach-view.js.
async function renderMemberActivities() {
  const container = document.getElementById("member-activities");

  // Gör ingenting om rutan saknas eller om användaren inte är medlem
  if (container === null || isMember() === false) {
    return;
  }

  try {
    // Vilket lag tillhör medlemmen? Det står i medlemsregistret.
    const user = getCurrentUser();
    const member = await getMemberById(user.memberId);
    if (member === null) {
      container.innerHTML = '<h2>Aktiviteter</h2><p class="muted">Din medlemsinformation hittades inte.</p>';
      return;
    }

    // Behåll bara kommande träningar för medlemmens eget lag
    // (aktivitetens namn är samma som lagets namn)
    const upcoming = await getUpcomingActivities();
    const own = [];
    for (let i = 0; i < upcoming.length; i++) {
      if (upcoming[i].namn === member.lag) {
        own.push(upcoming[i]);
      }
    }

    container.innerHTML = "<h2>Aktiviteter för " + member.lag + "</h2>";
    if (own.length === 0) {
      container.innerHTML += '<p class="muted">Inga kommande träningar.</p>';
      return;
    }

    // Ett kort per träning (som mest MEMBER_ACTIVITY_COUNT stycken)
    const list = document.createElement("div");
    list.className = "activity-list";

    for (let i = 0; i < own.length && i < MEMBER_ACTIVITY_COUNT; i++) {
      const activity = own[i];

      let spots = String(getAvailableSpots(activity));
      if (isActivityFull(activity)) {
        spots = "0 (full)";
      }

      const card = document.createElement("article");
      card.className = "activity-card";
      card.innerHTML =
        "<h3>" + activity.namn + "</h3>" +
        "<p>Datum: " + activity.veckodag.slice(0, 3) + " " + formatDate(activity.datum) + "</p>" +
        "<p>Tid: " + activity.tid + "</p>" +
        "<p>Plats: " + activity.plats + "</p>" +
        "<p>Tränare: " + activity.tranare_namn + "</p>" +
        "<p>Lediga platser: " + spots + "</p>";
      list.append(card);
    }
    container.append(list);

    // Finns det fler träningar än vi visar? Berätta det.
    if (own.length > MEMBER_ACTIVITY_COUNT) {
      const note = document.createElement("p");
      note.className = "muted";
      note.textContent = "Visar de " + MEMBER_ACTIVITY_COUNT + " första av " + own.length + " kommande träningar.";
      container.append(note);
    }

  } catch (error) {
    container.innerHTML = '<h2>Aktiviteter</h2><p class="error" role="alert">Kunde inte läsa träningsschemat: ' + error.message + "</p>";
  }
}

/* ------------------------------------------------------------------
   Testa i webbläsarens konsol (tryck F12):

   getAllActivities().then(console.log);
   getCoachById("TR-02").then(console.log);
   getUpcomingActivitiesByCoach("TR-02").then(console.log);
------------------------------------------------------------------- */
