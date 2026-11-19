"use strict";

/* ------------------------------------------------------------------
   Testanvändare för prototypen.
   OBS: Lösenorden ligger öppet i koden, så detta är bara en demo.
   I en riktig version ska inloggningen kontrolleras på en server.
------------------------------------------------------------------- */
const USERS = {
  // memberId kopplar medlemmen till medlemsregistret (medlemsnummer)
  medlem:  { password: "medlem123",  name: "Medlem",  role: "medlem", memberId: "EIF-1001" },
  tranare: { password: "tranare123", name: "Tränare", role: "tranare" },
  admin:   { password: "admin123",   name: "Admin",   role: "admin" }
};

/* Rollerna, den inloggade användaren och behörighetskontroller finns i roles.js */

/* ---------- Visa och dölj delar av sidan beroende på roll ---------- */
function applyAuthState() {
  const user = getCurrentUser();

  // Allt med data-roles visas bara om den inloggades roll finns i listan
  document.querySelectorAll("[data-roles]").forEach(el => {
    const allowed = el.dataset.roles.split(" ");
    el.hidden = !(user && allowed.includes(user.role));
  });

  // Inloggningsrutan visas bara när ingen är inloggad
  const loginView = document.getElementById("login-view");
  if (loginView) loginView.hidden = Boolean(user);

  if (user) {
    document.getElementById("user-name").textContent = user.name;
    document.getElementById("user-role").textContent = getRoleLabel(user.role);
  }
}

/* ---------- Visa rätt vy (aktiviteter, admin osv.) ---------- */
function showView() {
  const user = getCurrentUser();
  const views = document.querySelectorAll(".view");
  if (!user || views.length === 0) return;

  const allowedViews = Array.from(views).filter(v =>
    v.dataset.roles.split(" ").includes(user.role)
  );

  // Hash i adressen (#admin) styr vilken vy som visas. Annars den första tillåtna.
  const wanted = location.hash.slice(1);
  const current = allowedViews.find(v => v.id === wanted) || allowedViews[0];

  views.forEach(v => { v.hidden = v !== current; });

  document.querySelectorAll(".main-nav a").forEach(a => {
    const isActive = a.hash === "#" + current.id;
    a.classList.toggle("active", isActive);
    if (isActive) {
      a.setAttribute("aria-current", "page");
    } else {
      a.removeAttribute("aria-current");
    }
  });
}

/* ---------- Inloggning ---------- */
const loginForm = document.getElementById("login-form");

if (loginForm) {
  loginForm.addEventListener("submit", event => {
    event.preventDefault();

    const username = document.getElementById("username").value.trim().toLowerCase();
    const password = document.getElementById("password").value;
    const errorBox = document.getElementById("login-error");
    const account = USERS[username];

    if (!account || account.password !== password) {
      errorBox.hidden = false;
      return;
    }

    errorBox.hidden = true;
    setCurrentUser({
      username: username,
      name: account.name,
      role: account.role,
      memberId: account.memberId || null
    });
    loginForm.reset();

    // Börja på den första vyn som rollen får se
    history.replaceState(null, "", location.pathname);
    applyAuthState();
    showView();
    renderMemberViewIfAvailable();
  });
}

/* ---------- Utloggning ---------- */
const logoutBtn = document.getElementById("logout-btn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    clearCurrentUser();

    // På andra sidor än startsidan går man tillbaka till inloggningen
    if (!document.getElementById("login-view")) {
      location.href = "index.html";
      return;
    }

    history.replaceState(null, "", location.pathname);
    applyAuthState();

    const usernameField = document.getElementById("username");
    if (usernameField) usernameField.focus();
  });
}

/* ---------- Start ---------- */
// Fyller medlemsvyn om member-view.js finns på sidan
function renderMemberViewIfAvailable() {
  if (typeof renderMemberView === "function") renderMemberView();
}

window.addEventListener("hashchange", showView);
applyAuthState();
showView();
renderMemberViewIfAvailable();
