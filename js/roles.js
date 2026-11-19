"use strict";

/* ------------------------------------------------------------------
   roles.js: roller, inloggad användare och behörighetskontroller.

   Rollerna är: administratör, tränare och medlem.
   Den inloggade användaren sparas i sessionStorage (tills fliken stängs)
   av inloggningen i scripts.js.

   Exempel:
     if (isAdmin()) { ...visa administrationsknappar... }
     getUserRole();   // "admin", "tranare", "medlem" eller null
------------------------------------------------------------------- */

const ROLES = {
  ADMIN: "admin",
  COACH: "tranare",
  MEMBER: "medlem"
};

const ROLE_LABELS = {
  admin: "Administratör",
  tranare: "Tränare",
  medlem: "Medlem"
};

const SESSION_KEY = "eifInloggad";

/* ---------- Inloggad användare ---------- */

// Returnerar den inloggade användaren, eller null om ingen är inloggad
function getCurrentUser() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY));
  } catch (e) {
    return null;
  }
}

function setCurrentUser(user) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch (e) {
    /* Om lagring inte fungerar måste man logga in igen vid omladdning */
  }
}

function clearCurrentUser() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (e) { /* ignoreras */ }
}

/* ---------- Användarens roll ---------- */

// Returnerar rollen ("admin", "tranare" eller "medlem"), eller null om ingen är inloggad
function getUserRole() {
  const user = getCurrentUser();
  return user ? user.role : null;
}

// Returnerar rollens namn att visa på sidan, till exempel "Administratör"
function getRoleLabel(role) {
  return ROLE_LABELS[role] || "";
}

/* ---------- Behörighetskontroller ---------- */

function hasRole(role) {
  return getUserRole() === role;
}

// Är användaren administratör?
function isAdmin() {
  return hasRole(ROLES.ADMIN);
}

// Är användaren tränare?
function isCoach() {
  return hasRole(ROLES.COACH);
}

// Är användaren medlem?
function isMember() {
  return hasRole(ROLES.MEMBER);
}

// Är någon inloggad alls?
function isLoggedIn() {
  return getCurrentUser() !== null;
}
