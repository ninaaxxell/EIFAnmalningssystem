"use strict";
// "use strict" gör att JavaScript varnar oss om vi gör vanliga misstag,
// till exempel om vi skriver fel på ett variabelnamn.

/* ------------------------------------------------------------------
   roles.js: roller och behörighet

   Här finns:
   - de tre rollerna: administratör, tränare och medlem
   - funktioner som berättar vem som är inloggad
   - funktioner som svarar på "är användaren admin / tränare / medlem?"

   Exempel på hur andra filer kan använda dem:
     if (isAdmin()) { ...visa administrationsknappar... }
     getUserRole();   // ger "admin", "tranare", "medlem" eller null
------------------------------------------------------------------- */

// Rollernas namn i koden (skrivs alltid med små bokstäver)
const ROLES = {
  ADMIN: "admin",
  COACH: "tranare",
  MEMBER: "medlem"
};

// Rollernas namn som visas för användaren på sidan
const ROLE_LABELS = {
  admin: "Administratör",
  tranare: "Tränare",
  medlem: "Medlem"
};

// Namnet vi sparar den inloggade användaren under i webbläsaren
const SESSION_KEY = "eifInloggad";

/* ---------- Den inloggade användaren ---------- */

// Hämtar den inloggade användaren. Ger null om ingen är inloggad.
function getCurrentUser() {
  try {
    // sessionStorage kan bara spara text, så användaren sparas som text.
    // JSON.parse gör om texten till ett objekt igen.
    const text = sessionStorage.getItem(SESSION_KEY);
    if (text === null) {
      return null;
    }
    return JSON.parse(text);
  } catch (error) {
    // Om något går fel räknar vi det som att ingen är inloggad
    return null;
  }
}

// Sparar den inloggade användaren (sparas tills fliken stängs)
function setCurrentUser(user) {
  try {
    // JSON.stringify gör om objektet till text
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch (error) {
    // Går det inte att spara måste man logga in igen när sidan laddas om
  }
}

// Tar bort den inloggade användaren (används vid utloggning)
function clearCurrentUser() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (error) {
    // Inget att göra här
  }
}

/* ---------- Användarens roll ---------- */

// Ger rollen ("admin", "tranare" eller "medlem"), eller null om ingen är inloggad
function getUserRole() {
  const user = getCurrentUser();
  if (user === null) {
    return null;
  }
  return user.role;
}

// Ger rollens namn att visa på sidan, till exempel "Administratör"
function getRoleLabel(role) {
  if (ROLE_LABELS[role] === undefined) {
    return "";
  }
  return ROLE_LABELS[role];
}

/* ---------- Behörighetskontroller (svarar true eller false) ---------- */

// Har den inloggade användaren just den här rollen?
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

// Ger den inloggade tränarens id (till exempel "TR-02").
// Ger null om användaren inte är tränare.
function getCoachId() {
  const user = getCurrentUser();
  if (user === null || user.role !== ROLES.COACH) {
    return null;
  }
  if (user.tranareId === undefined) {
    return null;
  }
  return user.tranareId;
}
