"use strict";

/* ------------------------------------------------------------------
   activities.js: träningsschemat, aktiviteter och tränare

   Den här filen är Fannys activities.js ihopslagen med funktionerna
   som tränarsidan (coach-view.js) behöver.

   Filen gör fyra saker:
   1. Läser in schemat från JSON-filen
   2. Hämtar aktiviteter (alla, kommande, via id, via tränare)
   3. Hämtar tränare (via id)
   4. Visar medlemmens aktiviteter på "Min sida", med knappar för
      att anmäla sig och avregistrera sig, och en lista "Mina anmälningar"

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

/* ---------- Anmälan och avanmälan (medlemmar) ---------- */

// Är aktiviteten ett evenemang? (samma kategori som i admin.js)
// Alla andra aktiviteter är träningar.
function isEventActivity(activity) {
  return activity.kategori === "Evenemang";
}

// Vilka medlemsnummer är anmälda till aktiviteten?
// Finns listan "deltagare" används den. Annars gäller (precis som i admin.js):
// träning = hela laget är anmäld från början, evenemang = ingen är anmäld.
async function getRegisteredNumbers(activity) {
  if (Array.isArray(activity.deltagare)) {
    return activity.deltagare;
  }

  const numbers = [];
  if (isEventActivity(activity) === false) {
    const members = await getAllMembers();
    for (let i = 0; i < members.length; i++) {
      if (members[i].lag === activity.namn) {
        numbers.push(members[i].medlemsnummer);
      }
    }
  }
  return numbers;
}

// Ser till att aktiviteten har en egen lista "deltagare" innan vi ändrar den
async function ensureParticipantList(activity) {
  if (Array.isArray(activity.deltagare) === false) {
    const numbers = await getRegisteredNumbers(activity);
    activity.deltagare = numbers.slice(); // en kopia av listan
  }
}

// Anmäler en medlem till en aktivitet.
// Ger { ok: true/false, message: "text att visa" }
async function registerMemberToActivity(activityId, memberNumber) {
  const activity = await getActivityById(activityId);
  const member = await getMemberById(memberNumber);

  if (activity === null || member === null) {
    return { ok: false, message: "Aktiviteten eller medlemmen hittades inte." };
  }

  // Till en träning kan man bara anmäla sig om det är det egna lagets
  if (isEventActivity(activity) === false && activity.namn !== member.lag) {
    return { ok: false, message: "Du kan bara anmäla dig till ditt eget lags träningar." };
  }

  // Gamla aktiviteter går inte att anmäla sig till
  if (activity.datum < todayISO()) {
    return { ok: false, message: "Aktiviteten har redan varit." };
  }

  const numbers = await getRegisteredNumbers(activity);

  if (numbers.includes(member.medlemsnummer)) {
    return { ok: false, message: "Du är redan anmäld." };
  }
  if (numbers.length >= activity.max_deltagare) {
    return { ok: false, message: "Aktiviteten är full." };
  }

  // Lägg till medlemsnumret i listan över anmälda
  await ensureParticipantList(activity);
  activity.deltagare.push(member.medlemsnummer);
  activity.antal_anmälda = activity.deltagare.length;

  return { ok: true, message: "Du är nu anmäld till " + activity.namn + "." };
}

// Avregistrerar en medlem från en aktivitet.
// Ger { ok: true/false, message: "text att visa" }
async function unregisterMemberFromActivity(activityId, memberNumber) {
  const activity = await getActivityById(activityId);
  const member = await getMemberById(memberNumber);

  if (activity === null || member === null) {
    return { ok: false, message: "Aktiviteten eller medlemmen hittades inte." };
  }

  const numbers = await getRegisteredNumbers(activity);
  if (numbers.includes(member.medlemsnummer) === false) {
    return { ok: false, message: "Du är inte anmäld till den här aktiviteten." };
  }

  // Ta bort medlemsnumret ur listan över anmälda
  await ensureParticipantList(activity);
  const index = activity.deltagare.indexOf(member.medlemsnummer);
  activity.deltagare.splice(index, 1);
  activity.antal_anmälda = activity.deltagare.length;

  // Hade administratören markerat anmälan som betald tar vi bort markeringen
  if (Array.isArray(activity.betalda)) {
    const paidIndex = activity.betalda.indexOf(member.medlemsnummer);
    if (paidIndex !== -1) {
      activity.betalda.splice(paidIndex, 1);
    }
  }

  return { ok: true, message: "Du är nu avanmäld från " + activity.namn + "." };
}

/* ---------- Visa aktiviteter på medlemmens sida ---------- */

// Meddelande som visas efter en anmälan eller avanmälan.
// Det innehåller också "where": vilken ruta man klickade i, så att
// meddelandet visas just där (en gång).
let memberActivityMessage = null;

// Det här körs när medlemmen klickar på en knapp (Anmäl eller Avregistrera)
async function handleMemberActivityClick(event) {
  const button = event.target.closest("button[data-action]");
  if (button === null || isMember() === false) {
    return;
  }

  // Det är alltid den inloggade medlemmen som anmäls, aldrig någon annan
  const memberNumber = getCurrentUser().memberId;
  const activityId = Number(button.dataset.id);

  let result = null;
  if (button.dataset.action === "register") {
    result = await registerMemberToActivity(activityId, memberNumber);
  } else if (button.dataset.action === "unregister") {
    result = await unregisterMemberFromActivity(activityId, memberNumber);
  }

  if (result !== null) {
    // Spara meddelandet och vilken ruta (aktiviteter eller anmälningar) det ska visas i
    memberActivityMessage = { ok: result.ok, message: result.message, where: event.currentTarget.id };
  }

  // Rita om båda rutorna så att knappar, listor och lediga platser stämmer
  renderMemberActivities();
}

// Visar evenemang och medlemmens eget lags kommande träningar som kort,
// med knappar för att anmäla sig och avregistrera sig.
// Tränarens sida ritas av coach-view.js.
async function renderMemberActivities() {
  const container = document.getElementById("member-activities");

  // Gör ingenting om rutan saknas eller om användaren inte är medlem
  if (container === null || isMember() === false) {
    return;
  }

  // Koppla knapparna i rutan (görs bara en gång)
  if (container.dataset.buttonsReady !== "yes") {
    container.addEventListener("click", handleMemberActivityClick);
    container.dataset.buttonsReady = "yes";
  }

  // Rita också rutan "Mina anmälningar"
  renderMemberRegistrations();

  try {
    // Vilket lag tillhör medlemmen? Det står i medlemsregistret.
    const user = getCurrentUser();
    const member = await getMemberById(user.memberId);
    if (member === null) {
      container.innerHTML = '<h2>Aktiviteter</h2><p class="muted">Din medlemsinformation hittades inte.</p>';
      return;
    }

    // Sortera kommande aktiviteter: evenemang för sig och medlemmens eget lags träningar för sig
    const upcoming = await getUpcomingActivities();
    const events = [];
    const trainings = [];
    for (let i = 0; i < upcoming.length; i++) {
      if (isEventActivity(upcoming[i])) {
        events.push(upcoming[i]);
      } else if (upcoming[i].namn === member.lag) {
        trainings.push(upcoming[i]);
      }
    }

    container.innerHTML = "<h2>Aktiviteter för " + member.lag + "</h2>";

    // Meddelande från senaste anmälan eller avanmälan (visas en gång)
    if (memberActivityMessage !== null && memberActivityMessage.where === "member-activities") {
      const messageBox = document.createElement("p");
      messageBox.className = memberActivityMessage.ok ? "success" : "error";
      messageBox.setAttribute("role", "status");
      messageBox.textContent = memberActivityMessage.message;
      container.append(messageBox);
      memberActivityMessage = null;
    }

    if (events.length === 0 && trainings.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Inga kommande aktiviteter.";
      container.append(empty);
      return;
    }

    // Alla evenemang och de första träningarna (som mest MEMBER_ACTIVITY_COUNT stycken)
    const shown = events.concat(trainings.slice(0, MEMBER_ACTIVITY_COUNT));

    const list = document.createElement("div");
    list.className = "activity-list";

    for (let i = 0; i < shown.length; i++) {
      const activity = shown[i];

      // Är medlemmen anmäld, och hur många platser är lediga?
      const numbers = await getRegisteredNumbers(activity);
      const registered = numbers.includes(member.medlemsnummer);
      const free = activity.max_deltagare - numbers.length;

      let spots = String(free);
      if (free <= 0) {
        spots = "0 (full)";
      }

      let html =
        "<h3>" + activity.namn + "</h3>" +
        "<p>Typ: " + (isEventActivity(activity) ? "Evenemang" : "Träning") + "</p>" +
        "<p>Datum: " + activity.veckodag.slice(0, 3) + " " + formatDate(activity.datum) + "</p>" +
        "<p>Tid: " + activity.tid + "</p>" +
        "<p>Plats: " + activity.plats + "</p>" +
        "<p>Tränare: " + activity.tranare_namn + "</p>" +
        "<p>Lediga platser: " + spots + "</p>";

      // Evenemang kan ha en avgift
      if (isEventActivity(activity) && activity.avgift_eur !== undefined) {
        html += "<p>Avgift: " + activity.avgift_eur + " €</p>";
      }

      // Anmäld: visa status och knappen Avregistrera. Annars knappen Anmäl (eller "Full").
      if (registered) {
        html += '<p class="activity-status">Du är anmäld</p>' +
          '<button type="button" class="btn-ghost" data-action="unregister" data-id="' + activity.id + '">Avregistrera</button>';
      } else if (free > 0) {
        html += '<button type="button" class="btn-primary" data-action="register" data-id="' + activity.id + '">Anmäl</button>';
      } else {
        html += '<p class="muted">Aktiviteten är full.</p>';
      }

      const card = document.createElement("article");
      card.className = registered ? "activity-card registered" : "activity-card";
      card.innerHTML = html;
      list.append(card);
    }
    container.append(list);

    // Finns det fler träningar än vi visar? Berätta det.
    if (trainings.length > MEMBER_ACTIVITY_COUNT) {
      const note = document.createElement("p");
      note.className = "muted";
      note.textContent = "Visar de " + MEMBER_ACTIVITY_COUNT + " första av " + trainings.length + " kommande träningar.";
      container.append(note);
    }

  } catch (error) {
    container.innerHTML = '<h2>Aktiviteter</h2><p class="error" role="alert">Kunde inte läsa träningsschemat: ' + error.message + "</p>";
  }
}

/* ---------- Mina anmälningar (hela listan) ---------- */

// Har medlemmen betalat för den här anmälan?
// Träning: betald om årsavgiften är betald. Evenemang: om administratören markerat den som betald.
async function isRegistrationPaid(activity, member) {
  if (isEventActivity(activity)) {
    return Array.isArray(activity.betalda) && activity.betalda.includes(member.medlemsnummer);
  }
  return await hasPaidAnnualFee(member.medlemsnummer);
}

// Lägger till en cell med text i en tabellrad
function addRegistrationCell(row, text) {
  const cell = row.insertCell();
  cell.textContent = text;
  return cell;
}

// Visar ALLA kommande aktiviteter som medlemmen är anmäld till, som en tabell
// med betalstatus och en knapp för att avregistrera sig.
async function renderMemberRegistrations() {
  const container = document.getElementById("member-registrations");

  // Gör ingenting om rutan saknas eller om användaren inte är medlem
  if (container === null || isMember() === false) {
    return;
  }

  // Koppla knapparna i rutan (görs bara en gång). Samma funktion som för aktivitetskorten.
  if (container.dataset.buttonsReady !== "yes") {
    container.addEventListener("click", handleMemberActivityClick);
    container.dataset.buttonsReady = "yes";
  }

  try {
    const user = getCurrentUser();
    const member = await getMemberById(user.memberId);
    if (member === null) {
      container.innerHTML = '<h2>Mina anmälningar</h2><p class="muted">Din medlemsinformation hittades inte.</p>';
      return;
    }

    // Gå igenom alla kommande aktiviteter och samla de som medlemmen är anmäld till
    const upcoming = await getUpcomingActivities();
    const mine = [];
    for (let i = 0; i < upcoming.length; i++) {
      const numbers = await getRegisteredNumbers(upcoming[i]);
      if (numbers.includes(member.medlemsnummer)) {
        mine.push(upcoming[i]);
      }
    }

    container.innerHTML = "<h2>Mina anmälningar (" + mine.length + ")</h2>";

    // Meddelande från senaste anmälan eller avanmälan (visas en gång)
    if (memberActivityMessage !== null && memberActivityMessage.where === "member-registrations") {
      const messageBox = document.createElement("p");
      messageBox.className = memberActivityMessage.ok ? "success" : "error";
      messageBox.setAttribute("role", "status");
      messageBox.textContent = memberActivityMessage.message;
      container.append(messageBox);
      memberActivityMessage = null;
    }

    if (mine.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Du är inte anmäld till någon kommande aktivitet.";
      container.append(empty);
      return;
    }

    // Bygg tabellen
    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    const table = document.createElement("table");
    table.className = "data";

    // Rubrikraden
    const headRow = table.createTHead().insertRow();
    const headings = ["När", "Aktivitet", "Plats", "Betalning", ""];
    for (let i = 0; i < headings.length; i++) {
      const th = document.createElement("th");
      th.textContent = headings[i];
      headRow.append(th);
    }

    // En rad per anmälan
    const tbody = table.createTBody();
    for (let i = 0; i < mine.length; i++) {
      const activity = mine[i];
      const row = tbody.insertRow();

      addRegistrationCell(row, activity.veckodag.slice(0, 3) + " " + formatDate(activity.datum) + " kl. " + activity.tid);

      let name = activity.namn;
      if (isEventActivity(activity)) {
        name = "Evenemang: " + name;
      }
      addRegistrationCell(row, name);
      addRegistrationCell(row, activity.plats);

      // Betalning: märket "Betald" eller "Obetald" (och avgiften för evenemang)
      const payCell = row.insertCell();
      const badge = document.createElement("span");
      if (await isRegistrationPaid(activity, member)) {
        badge.textContent = "Betald";
        badge.className = "badge badge-paid";
      } else {
        badge.textContent = "Obetald";
        badge.className = "badge badge-unpaid";
      }
      payCell.append(badge);
      if (isEventActivity(activity) && activity.avgift_eur !== undefined) {
        payCell.append(" " + activity.avgift_eur + " €");
      }

      // Knappen "Avregistrera"
      const actionCell = row.insertCell();
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn-ghost";
      button.textContent = "Avregistrera";
      button.dataset.action = "unregister";
      button.dataset.id = activity.id;
      actionCell.append(button);
    }

    wrap.append(table);
    container.append(wrap);

  } catch (error) {
    container.innerHTML = '<h2>Mina anmälningar</h2><p class="error" role="alert">Kunde inte läsa anmälningarna: ' + error.message + "</p>";
  }
}

/* ------------------------------------------------------------------
   Testa i webbläsarens konsol (tryck F12):

   getAllActivities().then(console.log);
   getCoachById("TR-02").then(console.log);
   getUpcomingActivitiesByCoach("TR-02").then(console.log);
------------------------------------------------------------------- */
