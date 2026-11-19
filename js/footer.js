"use strict";

/* ------------------------------------------------------------------
   Footer: ligger på ett ställe och används av alla sidor.
   Ändra här så ändras den överallt.
------------------------------------------------------------------- */
(function () {
  const target = document.getElementById("site-footer");
  if (!target) return;

  target.innerHTML = `
    <div class="footer-inner">
      <address>
        <strong>Ekenäs Idrottsförening rf</strong><br>
        EIF Fotboll<br>
        Ladugårdsgatan 14<br>
        10600 Ekenäs
      </address>
      <p class="footer-slogan">EIF - Laget före jaget!</p>
      <p class="footer-copy">&copy; 2026 Ekenäs Idrottsförening rf. Prototyp, inte för skarp användning.</p>
    </div>
  `;
})();
