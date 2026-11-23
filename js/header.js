"use strict";

/* ------------------------------------------------------------------
   header.js: sidans övre del (logotyp, meny, användare, kontaktknapp)

   Headern ligger på ett ställe och används av alla sidor. Ändrar du
   här ändras den överallt. Varje sida har en tom <header id="site-header">
   som den här filen fyller med innehåll.
------------------------------------------------------------------- */

// Hitta den tomma headern på sidan
const headerElement = document.getElementById("site-header");

if (headerElement !== null) {

  // Är vi på kontaktsidan? Då markeras kontaktknappen som vald.
  const onContactPage = location.pathname.endsWith("kontakt.html");
  let contactMark = "";
  if (onContactPage) {
    contactMark = ' aria-current="page"';
  }

  // Texten mellan `...` är HTML. ${...} sätter in värdet av en variabel.
  // data-roles anger vilka roller som får se en länk eller ruta,
  // och "hidden" betyder att den är dold tills man har loggat in.
  headerElement.innerHTML = `
    <div class="header-inner">
      <a class="logo" href="index.html">
        <img src="images/EIF_logo_png-scaled.png" alt="EIF Fotboll logotyp">
        <span>EIF Fotboll</span>
      </a>

      <nav class="main-nav" aria-label="Huvudmeny" data-roles="medlem tranare admin" hidden>
        <a href="index.html#min-sida" data-roles="medlem">Min sida</a>
        <a href="index.html#aktiviteter" data-roles="admin">Aktiviteter</a>
        <a href="index.html#mina-evenemang" data-roles="tranare">Mina evenemang</a>
        <a href="index.html#admin" data-roles="admin">Administration</a>
      </nav>

      <div class="user-info" data-roles="medlem tranare admin" hidden>
        <span>
          <strong id="user-name"></strong>
          <span id="user-role" class="role-badge"></span>
        </span>
        <button type="button" id="logout-btn" class="btn-ghost">Logga ut</button>
      </div>

      <a class="btn-contact" href="kontakt.html"${contactMark}>Kontakt</a>
    </div>
  `;
}
