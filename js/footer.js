"use strict";

/* ------------------------------------------------------------------
   footer.js: sidans nedre del (adress, slogan och copyright)

   Footern ligger på ett ställe och används av alla sidor. Ändrar du
   här ändras den överallt. Varje sida har en tom <footer id="site-footer">
   som den här filen fyller med innehåll.
------------------------------------------------------------------- */

// Hitta den tomma footern på sidan
const footerElement = document.getElementById("site-footer");

if (footerElement !== null) {
  // Texten mellan `...` är HTML som sätts in i footern
  footerElement.innerHTML = `
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
}
