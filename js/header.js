"use strict";

/* ------------------------------------------------------------------
   Header: ligger på ett ställe och används av alla sidor.
   Ändra här så ändras den överallt.
------------------------------------------------------------------- */
(function () {
  const target = document.getElementById("site-header");
  if (!target) return;

  const onContactPage = location.pathname.endsWith("kontakt.html");

  target.innerHTML = `
    <div class="header-inner">
      <a class="logo" href="index.html">
        <img src="images/EIF_logo_png-scaled.png" alt="EIF Fotboll logotyp">
        <span>EIF Fotboll</span>
      </a>

      <!-- Menyn visas först efter inloggning. data-roles styr vem som ser vilken länk. -->
      <nav class="main-nav" aria-label="Huvudmeny" data-roles="medlem tranare admin" hidden>
        <a href="index.html#min-sida" data-roles="medlem">Min sida</a>
        <a href="index.html#aktiviteter" data-roles="tranare admin">Aktiviteter</a>
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

      <a class="btn-contact" href="kontakt.html"${onContactPage ? ' aria-current="page"' : ""}>Kontakt</a>
    </div>
  `;
})();
