"use strict";

/* ------------------------------------------------------------------
   scripts.js: inloggning, utloggning och vilken del av sidan som visas

   Den här filen gör tre saker:
   1. Låter användaren logga in och ut
   2. Visar eller döljer delar av sidan beroende på roll
   3. Visar rätt vy (Min sida, Mina evenemang, Administration)

   Rollerna och "vem är inloggad" finns i roles.js.
------------------------------------------------------------------- */

/* ------------------------------------------------------------------
   Testanvändare för prototypen.
   OBS: Lösenorden ligger öppet i koden, så detta är bara en demo.
   I en riktig version ska inloggningen kontrolleras på en server.

   - memberId kopplar medlemmen till medlemsregistret (medlemsnummer)
   - tranareId kopplar tränaren till träningsschemat (tranare_id)
------------------------------------------------------------------- */
const USERS = {
  // memberId kopplar medlemmen till medlemsregistret (medlemsnummer)
  medlem: { password: "medlem123",  name: "Medlem",  role: "medlem", memberId: "EIF-1001" },
  // Tränare. tranareId finns i träningsschemat (tranare_id) och används för att filtrera aktiviteter.
  // "tranare" är samma som tranare2 (TR-02). Övriga: tranare1–tranare16.
  tranare: { password: "tranare123", name: "Sofia Berglund", role: "tranare", tranareId: "TR-02" },
  tranare1: { password: "tranare123", name: "Mikael Lindqvist", role: "tranare", tranareId: "TR-01" },
  tranare2: { password: "tranare123", name: "Sofia Berglund", role: "tranare", tranareId: "TR-02" },
  tranare3: { password: "tranare123", name: "Jonas Holmberg", role: "tranare", tranareId: "TR-03" },
  tranare4: { password: "tranare123", name: "Linda Östman", role: "tranare", tranareId: "TR-04" },
  tranare5: { password: "tranare123", name: "Patrik Sundström", role: "tranare", tranareId: "TR-05" },
  tranare6: { password: "tranare123", name: "Anna Wikström", role: "tranare", tranareId: "TR-06" },
  tranare7: { password: "tranare123", name: "Henrik Strand", role: "tranare", tranareId: "TR-07" },
  tranare8: { password: "tranare123", name: "Maria Forsman", role: "tranare", tranareId: "TR-08" },
  tranare9: { password: "tranare123", name: "Tomas Eklund", role: "tranare", tranareId: "TR-09" },
  tranare10: { password: "tranare123", name: "Karin Nordlund", role: "tranare", tranareId: "TR-10" },
  tranare11: { password: "tranare123", name: "Daniel Åkerman", role: "tranare", tranareId: "TR-11" },
  tranare12: { password: "tranare123", name: "Emma Rosenberg", role: "tranare", tranareId: "TR-12" },
  tranare13: { password: "tranare123", name: "Robin Lundqvist", role: "tranare", tranareId: "TR-13" },
  tranare14: { password: "tranare123", name: "Helena Back", role: "tranare", tranareId: "TR-14" },
  tranare15: { password: "tranare123", name: "Fredrik Sjöblom", role: "tranare", tranareId: "TR-15" },
  tranare16: { password: "tranare123", name: "Camilla Engström", role: "tranare", tranareId: "TR-16" },
  admin: { password: "admin123",    name: "Admin",   role: "admin" }
};

/* ---------- Visa och dölj delar av sidan beroende på roll ---------- */
function applyAuthState() {
  const user = getCurrentUser();

  // Allt i HTML som har data-roles="..." visas bara om den inloggades roll
  // finns med i listan. Annars döljs det.
  const elements = document.querySelectorAll("[data-roles]");
  for (let i = 0; i < elements.length; i++) {
    const allowedRoles = elements[i].dataset.roles.split(" "); // t.ex. ["tranare", "admin"]

    if (user !== null && allowedRoles.includes(user.role)) {
      elements[i].hidden = false; // visa
    } else {
      elements[i].hidden = true;  // dölj
    }
  }

  // Inloggningsrutan visas bara när ingen är inloggad
  const loginView = document.getElementById("login-view");
  if (loginView !== null) {
    loginView.hidden = (user !== null);
  }

  // Visa namn och roll uppe i headern
  if (user !== null) {
    document.getElementById("user-name").textContent = user.name;
    document.getElementById("user-role").textContent = getRoleLabel(user.role);
  }
}

/* ---------- Visa rätt vy ---------- */
function showView() {
  const user = getCurrentUser();
  const views = document.querySelectorAll(".view");

  // Inget att göra om ingen är inloggad eller om sidan inte har några vyer
  if (user === null || views.length === 0) {
    return;
  }

  // Samla de vyer som den här rollen får se
  const allowedViews = [];
  for (let i = 0; i < views.length; i++) {
    const roles = views[i].dataset.roles.split(" ");
    if (roles.includes(user.role)) {
      allowedViews.push(views[i]);
    }
  }

  // Adressen kan sluta på till exempel #admin. Det är den vy man vill se.
  const wantedId = location.hash.slice(1); // tar bort tecknet #

  // Börja med den första tillåtna vyn, byt om den önskade vyn är tillåten
  let currentView = allowedViews[0];
  for (let i = 0; i < allowedViews.length; i++) {
    if (allowedViews[i].id === wantedId) {
      currentView = allowedViews[i];
    }
  }

  // Visa bara den valda vyn, dölj de andra
  for (let i = 0; i < views.length; i++) {
    views[i].hidden = (views[i] !== currentView);
  }

  // Markera rätt länk i menyn
  const links = document.querySelectorAll(".main-nav a");
  for (let i = 0; i < links.length; i++) {
    if (links[i].hash === "#" + currentView.id) {
      links[i].classList.add("active");
      links[i].setAttribute("aria-current", "page");
    } else {
      links[i].classList.remove("active");
      links[i].removeAttribute("aria-current");
    }
  }
}

// Ritar upp sidorna för medlem, tränare och admin (om filerna finns på sidan).
// Varje funktion gör bara något om rätt roll är inloggad.
function renderMemberViewIfAvailable() {
  if (typeof renderMemberView === "function") {
    renderMemberView();       // member-view.js: uppgifter och årsavgift
  }
  if (typeof renderMemberActivities === "function") {
    renderMemberActivities(); // activities.js: medlemmens aktiviteter
  }
  if (typeof renderCoachView === "function") {
    renderCoachView();        // coach-view.js: tränarens evenemang
  }
  if (typeof renderAdminView === "function") {
    renderAdminView();        // admin.js: medlemslista med årsavgift
  }
}

/* ---------- Inloggning ---------- */
const loginForm = document.getElementById("login-form");

// loginForm finns bara på startsidan, inte på kontaktsidan
if (loginForm !== null) {

  // Det här körs när man klickar på "Logga in"
  loginForm.addEventListener("submit", function (event) {
    event.preventDefault(); // hindra att sidan laddas om

    // Läs det som användaren skrev
    const username = document.getElementById("username").value.trim().toLowerCase();
    const password = document.getElementById("password").value;
    const errorBox = document.getElementById("login-error");

    // Leta upp användaren i listan USERS
    const account = USERS[username];

    // Fel användarnamn eller lösenord? Visa felet och avbryt.
    if (account === undefined || account.password !== password) {
      errorBox.hidden = false;
      return;
    }

    errorBox.hidden = true;

    // Spara vem som är inloggad
    setCurrentUser({
      username: username,
      name: account.name,
      role: account.role,
      memberId: account.memberId || null,
      tranareId: account.tranareId || null
    });
    loginForm.reset(); // töm fälten

    // Börja på den första vyn som rollen får se
    history.replaceState(null, "", location.pathname);
    applyAuthState();
    showView();
    renderMemberViewIfAvailable();
  });
}

/* ---------- Utloggning ---------- */
const logoutBtn = document.getElementById("logout-btn");

if (logoutBtn !== null) {
  logoutBtn.addEventListener("click", function () {
    clearCurrentUser();

    // Är vi på en annan sida än startsidan? Gå då till startsidan (inloggningen).
    if (document.getElementById("login-view") === null) {
      location.href = "index.html";
      return;
    }

    history.replaceState(null, "", location.pathname);
    applyAuthState();

    // Sätt markören i fältet för användarnamn
    document.getElementById("username").focus();
  });
}

/* ---------- Start: det här körs när sidan har laddats ---------- */

// Byter man vy (till exempel genom att klicka i menyn) visas rätt vy
window.addEventListener("hashchange", showView);

applyAuthState();
showView();
renderMemberViewIfAvailable();
