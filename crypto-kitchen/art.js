/* Crypto Kitchen — drawn art. One SVG sprite of dishes (raw and cooked),
   kitchen props and scenery, plus cartoon customer busts built per
   customer so their mood can change. Everything is vector: no emoji. */
(function () {
  'use strict';
  var SPRITE =
  '<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">' +
  '<defs>' +
  '<linearGradient id="gBun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFCB6B"/><stop offset="1" stop-color="#D98A2B"/></linearGradient>' +
  '<linearGradient id="gPatty" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8A4B25"/><stop offset="1" stop-color="#4E2811"/></linearGradient>' +
  '<linearGradient id="gRaw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F0716E"/><stop offset="1" stop-color="#C13B46"/></linearGradient>' +
  '<linearGradient id="gSteak" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A55A31"/><stop offset="1" stop-color="#6B3416"/></linearGradient>' +
  '<linearGradient id="gCup" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7FD9FF"/><stop offset=".5" stop-color="#3FB6F0"/><stop offset="1" stop-color="#2A8FD0"/></linearGradient>' +
  '<linearGradient id="gBox" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#F0503C"/><stop offset="1" stop-color="#C22D22"/></linearGradient>' +
  '<linearGradient id="gCrust" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2B15C"/><stop offset="1" stop-color="#C77A2A"/></linearGradient>' +
  '<radialGradient id="gPlate" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".8" stop-color="#EDEDED"/><stop offset="1" stop-color="#C9C9C9"/></radialGradient>' +
  '<radialGradient id="gYolk" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#FFE066"/><stop offset="1" stop-color="#F5A623"/></radialGradient>' +
  '</defs>' +
  // ---- cooked dishes ----
  '<symbol id="c-burger" viewBox="0 0 100 100">' +
  '<ellipse cx="50" cy="90" rx="42" ry="7" fill="rgba(0,0,0,.18)"/>' +
  '<path d="M12 78q0-8 8-8h60q8 0 8 8v3q0 8-8 8H20q-8 0-8-8z" fill="url(#gBun)" stroke="#7A4413" stroke-width="3"/>' +
  '<path d="M10 66q10 8 20 0t20 0 20 0 20 0v8H10z" fill="#55B54A" stroke="#2F7A2A" stroke-width="3" stroke-linejoin="round"/>' +
  '<rect x="14" y="52" width="72" height="14" rx="6" fill="url(#gPatty)" stroke="#2E1608" stroke-width="3"/>' +
  '<path d="M18 52h64l-8 10H26z" fill="#FFC733" stroke="#C98A00" stroke-width="2.5"/>' +
  '<ellipse cx="50" cy="48" rx="34" ry="6" fill="#E3412B" stroke="#8C1E12" stroke-width="2.5"/>' +
  '<path d="M10 46q0-30 40-32 40 2 40 32z" fill="url(#gBun)" stroke="#7A4413" stroke-width="3"/>' +
  '<g fill="#FFF3D0"><ellipse cx="34" cy="30" rx="3.5" ry="2"/><ellipse cx="50" cy="24" rx="3.5" ry="2"/><ellipse cx="66" cy="30" rx="3.5" ry="2"/><ellipse cx="42" cy="38" rx="3.5" ry="2"/><ellipse cx="60" cy="38" rx="3.5" ry="2"/></g>' +
  '</symbol>' +
  '<symbol id="c-fries" viewBox="0 0 100 100">' +
  '<ellipse cx="50" cy="92" rx="36" ry="6" fill="rgba(0,0,0,.18)"/>' +
  '<g stroke="#B8860B" stroke-width="2.5" stroke-linejoin="round"><rect x="30" y="8" width="10" height="50" rx="3" fill="#FFD54A" transform="rotate(-14 35 33)"/><rect x="45" y="4" width="10" height="54" rx="3" fill="#FFDE6B"/><rect x="60" y="8" width="10" height="50" rx="3" fill="#FFD54A" transform="rotate(14 65 33)"/><rect x="38" y="14" width="10" height="46" rx="3" fill="#FFC93A" transform="rotate(-6 43 37)"/><rect x="53" y="14" width="10" height="46" rx="3" fill="#FFC93A" transform="rotate(6 58 37)"/></g>' +
  '<path d="M18 44h64l-8 46H26z" fill="url(#gBox)" stroke="#7E160F" stroke-width="3" stroke-linejoin="round"/>' +
  '<path d="M18 44h64l-3 12H21z" fill="#FF7A66" opacity=".7"/>' +
  '<path d="M40 60q10 10 20 0" stroke="#FFD54A" stroke-width="5" fill="none" stroke-linecap="round"/>' +
  '</symbol>' +
  '<symbol id="c-steak" viewBox="0 0 100 100">' +
  '<ellipse cx="50" cy="92" rx="40" ry="6" fill="rgba(0,0,0,.18)"/>' +
  '<ellipse cx="50" cy="68" rx="44" ry="24" fill="url(#gPlate)" stroke="#9E9E9E" stroke-width="2.5"/>' +
  '<path d="M20 58q-4-22 22-26 22-4 34 8 10 12 0 22-10 12-30 10-22-2-26-14z" fill="url(#gSteak)" stroke="#3B1A08" stroke-width="3" stroke-linejoin="round"/>' +
  '<g stroke="#2E1206" stroke-width="3" stroke-linecap="round" opacity=".75"><path d="M28 44l38 4M26 54l40 4M30 63l30 3"/></g>' +
  '<ellipse cx="72" cy="66" rx="16" ry="11" fill="#FFF" stroke="#DADADA" stroke-width="2"/><circle cx="72" cy="65" r="7" fill="url(#gYolk)" stroke="#D98A2B" stroke-width="1.5"/>' +
  '<g stroke="#B8860B" stroke-width="1.5"><rect x="12" y="62" width="5" height="18" rx="2" fill="#FFD54A" transform="rotate(-20 14 71)"/><rect x="18" y="60" width="5" height="20" rx="2" fill="#FFDE6B"/><rect x="24" y="62" width="5" height="18" rx="2" fill="#FFD54A" transform="rotate(15 26 71)"/></g>' +
  '</symbol>' +
  '<symbol id="c-soda" viewBox="0 0 100 100">' +
  '<ellipse cx="50" cy="92" rx="26" ry="5" fill="rgba(0,0,0,.18)"/>' +
  '<rect x="58" y="6" width="6" height="40" rx="3" fill="#E3412B" transform="rotate(12 61 26)" stroke="#8C1E12" stroke-width="1.5"/>' +
  '<path d="M26 30h48l-5 56q-1 4-5 4H36q-4 0-5-4z" fill="url(#gCup)" stroke="#1A5F8F" stroke-width="3" stroke-linejoin="round"/>' +
  '<rect x="22" y="22" width="56" height="12" rx="5" fill="#FFFFFF" stroke="#1A5F8F" stroke-width="3"/>' +
  '<path d="M34 46h32l-3 28H37z" fill="#FFFFFF" opacity=".28"/>' +
  '<g fill="#E9F8FF" opacity=".9"><rect x="36" y="52" width="10" height="10" rx="2"/><rect x="50" y="60" width="10" height="10" rx="2"/></g>' +
  '</symbol>' +
  '<symbol id="c-pizza" viewBox="0 0 100 100">' +
  '<ellipse cx="50" cy="92" rx="40" ry="6" fill="rgba(0,0,0,.18)"/>' +
  '<circle cx="50" cy="52" r="42" fill="url(#gCrust)" stroke="#8A4A14" stroke-width="3"/>' +
  '<circle cx="50" cy="52" r="33" fill="#D6382B"/><circle cx="50" cy="52" r="30" fill="#FFD966"/>' +
  '<g fill="#B82E27" stroke="#7A1B14" stroke-width="1.5"><circle cx="38" cy="42" r="6"/><circle cx="60" cy="38" r="6"/><circle cx="64" cy="60" r="6"/><circle cx="44" cy="64" r="6"/><circle cx="52" cy="52" r="5"/></g>' +
  '<g fill="#3E8E2E"><ellipse cx="48" cy="34" rx="5" ry="3" transform="rotate(-20 48 34)"/><ellipse cx="70" cy="50" rx="5" ry="3"/><ellipse cx="34" cy="56" rx="5" ry="3" transform="rotate(30 34 56)"/></g>' +
  '</symbol>' +
  // ---- raw ingredients ----
  '<symbol id="r-burger" viewBox="0 0 100 100"><ellipse cx="50" cy="60" rx="36" ry="24" fill="url(#gRaw)" stroke="#7C1F2A" stroke-width="3"/><g fill="#FFD3D0" opacity=".7"><ellipse cx="38" cy="54" rx="6" ry="3"/><ellipse cx="58" cy="64" rx="7" ry="3"/><ellipse cx="60" cy="50" rx="4" ry="2"/></g></symbol>' +
  '<symbol id="r-fries" viewBox="0 0 100 100"><g stroke="#B99A3A" stroke-width="2.5"><rect x="22" y="40" width="14" height="42" rx="4" fill="#F4E39C" transform="rotate(-10 29 61)"/><rect x="43" y="34" width="14" height="48" rx="4" fill="#F8EAA8"/><rect x="64" y="40" width="14" height="42" rx="4" fill="#F4E39C" transform="rotate(10 71 61)"/></g><ellipse cx="50" cy="30" rx="22" ry="14" fill="#C9A066" stroke="#8A6A2A" stroke-width="2.5"/></symbol>' +
  '<symbol id="r-steak" viewBox="0 0 100 100"><path d="M20 58q-4-22 22-26 22-4 34 8 10 12 0 22-10 12-30 10-22-2-26-14z" fill="url(#gRaw)" stroke="#7C1F2A" stroke-width="3" stroke-linejoin="round"/><path d="M30 42q14 4 30 0M26 56q16 6 36 0" stroke="#FFE6E3" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/><path d="M20 58q-2 16 16 18" stroke="#FFF3EE" stroke-width="7" fill="none" stroke-linecap="round" opacity=".9"/></symbol>' +
  '<symbol id="r-soda" viewBox="0 0 100 100"><g fill="#CDEFFF" stroke="#5FB8E8" stroke-width="2.5"><rect x="18" y="40" width="30" height="30" rx="6" transform="rotate(-8 33 55)"/><rect x="52" y="34" width="30" height="30" rx="6" transform="rotate(10 67 49)"/><rect x="36" y="58" width="28" height="28" rx="6"/></g><path d="M24 46l8-2M58 40l8-2" stroke="#FFF" stroke-width="3" stroke-linecap="round"/></symbol>' +
  '<symbol id="r-pizza" viewBox="0 0 100 100"><circle cx="50" cy="54" r="40" fill="#F3E2B5" stroke="#C9A55C" stroke-width="3"/><circle cx="50" cy="54" r="30" fill="#EAD39A"/><g fill="#D6382B" opacity=".6"><circle cx="50" cy="54" r="22"/></g></symbol>' +
  // ---- scenery ----
  '<symbol id="plant" viewBox="0 0 100 100"><path d="M30 68h40l-5 26H35z" fill="#D9573B" stroke="#7A2A18" stroke-width="3" stroke-linejoin="round"/><rect x="26" y="62" width="48" height="10" rx="4" fill="#E86E4E" stroke="#7A2A18" stroke-width="3"/><g fill="#3FA34D" stroke="#1F6E2C" stroke-width="2.5" stroke-linejoin="round"><path d="M50 62q-30-10-26-40 22 6 26 40z"/><path d="M50 62q30-10 26-40-22 6-26 40z"/><path d="M50 62q-6-30 0-48 6 18 0 48z"/></g></symbol>' +
  '<symbol id="lantern" viewBox="0 0 100 100"><rect x="46" y="4" width="8" height="14" fill="#F2C14E"/><rect x="34" y="16" width="32" height="8" rx="3" fill="#F2C14E" stroke="#8A5A00" stroke-width="2"/><ellipse cx="50" cy="52" rx="30" ry="30" fill="#F04A3A" stroke="#8A1E12" stroke-width="3"/><g stroke="#B8251A" stroke-width="2.5" fill="none"><path d="M34 26q-8 26 0 52M50 22v60M66 26q8 26 0 52"/></g><rect x="34" y="78" width="32" height="8" rx="3" fill="#F2C14E" stroke="#8A5A00" stroke-width="2"/><path d="M44 86v10M50 86v12M56 86v10" stroke="#F2C14E" stroke-width="3"/></symbol>' +
  '<symbol id="jar" viewBox="0 0 100 100"><rect x="28" y="10" width="44" height="14" rx="4" fill="#3A3A3A" stroke="#111" stroke-width="3"/><path d="M22 24h56q6 0 6 8v50q0 12-12 12H28q-12 0-12-12V32q0-8 6-8z" fill="#E23B2E" stroke="#7E160F" stroke-width="3"/><rect x="30" y="42" width="40" height="30" rx="4" fill="#FFF6E0" stroke="#7E160F" stroke-width="2"/><path d="M36 50h28M36 58h20M36 66h24" stroke="#E23B2E" stroke-width="3" stroke-linecap="round"/><path d="M26 30q0 40 4 56" stroke="#FFF" stroke-width="5" opacity=".35" stroke-linecap="round"/></symbol>' +
  '<symbol id="chair" viewBox="0 0 100 100"><path d="M30 10h40v44H30z" fill="#C97B3A" stroke="#6B3A12" stroke-width="3" rx="6"/><rect x="22" y="50" width="56" height="14" rx="5" fill="#E8964C" stroke="#6B3A12" stroke-width="3"/><path d="M28 64v30M72 64v30M34 22h32M34 34h32" stroke="#6B3A12" stroke-width="4" stroke-linecap="round"/></symbol>' +
  '<symbol id="chef" viewBox="0 0 100 100"><path d="M20 40q-8-24 14-26 6-14 22-8 18-6 24 10 18 6 6 24H20z" fill="#FFFFFF" stroke="#8A4A1E" stroke-width="3"/><rect x="24" y="36" width="52" height="10" fill="#F4F4F4" stroke="#8A4A1E" stroke-width="3"/><circle cx="50" cy="62" r="20" fill="#FFD9B3" stroke="#8A4A1E" stroke-width="3"/><g fill="#3A1F0F"><circle cx="43" cy="60" r="2.5"/><circle cx="57" cy="60" r="2.5"/></g><path d="M42 70q8 6 16 0" stroke="#B0402E" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M30 100q4-18 20-18t20 18z" fill="#FFFFFF" stroke="#8A4A1E" stroke-width="3"/><path d="M44 84h12" stroke="#E3412B" stroke-width="4"/></symbol>' +
  '</svg>';

  function icon(name, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#' + name + '"/></svg>'; }

  // ---- customers: cartoon busts. hair style + colours vary; the mouth and brows follow the mood ----
  var HAIR = {
    bob: 'M22 44q-4-30 28-32 32 2 28 32-6-14-16-16-6 12-24 8-8 8-16 8z',
    short: 'M24 40q0-26 26-26t26 26q-8-10-26-10T24 40z',
    bun: 'M26 40q0-22 24-24 24 2 24 24-6-8-24-8t-24 8zM40 16a10 10 0 1 1 20 0 10 10 0 0 1-20 0z',
    long: 'M20 48q-2-34 30-36 32 2 30 36l-6 30h-8l-2-34q-14-4-28 0l-2 34h-8z',
    bald: 'M30 36q4-14 20-14t20 14q-10-6-20-6t-20 6z',
    cap: 'M22 42q0-28 28-28t28 28l10 2v6H14v-6z'
  };
  var SKIN = ['#FFD9B3', '#F5C99B', '#E0AC7A', '#C68642', '#8D5524', '#FFE0C2'];
  var HAIRC = ['#3A2411', '#B4562A', '#E8C56C', '#F2F2F2', '#8A3A9C', '#1B1B1B', '#D7452A'];
  var SHIRT = ['#3BC9C4', '#F0433C', '#7B4DD8', '#FF8A1F', '#37D67A', '#FF5DA2', '#2F78D6', '#F5B301'];
  var MOUTH = { happy: 'M40 66q10 9 20 0', ok: 'M42 68h16', angry: 'M40 70q10-8 20 0' };
  var BROW = { happy: 'M36 50l10-2M54 48l10 2', ok: 'M36 49h10M54 49h10', angry: 'M36 46l10 4M54 50l10-4' };
  function rnd(a) { return a[Math.floor(Math.random() * a.length)]; }
  function character(seed) {
    var hairKey = seed && seed.hair || rnd(Object.keys(HAIR));
    var skin = seed && seed.skin || rnd(SKIN), hair = seed && seed.hairc || rnd(HAIRC), shirt = seed && seed.shirt || rnd(SHIRT);
    return '<svg class="char" viewBox="0 0 100 110" aria-hidden="true">' +
      '<path d="M18 110q0-30 32-30t32 30z" fill="' + shirt + '" stroke="#3A1F0F" stroke-width="3"/>' +
      '<path d="M40 80q10 10 20 0" fill="#FFF" stroke="#3A1F0F" stroke-width="2.5"/>' +
      (hairKey === 'long' ? '<path d="' + HAIR.long + '" fill="' + hair + '" stroke="#3A1F0F" stroke-width="3" stroke-linejoin="round"/>' : '') +
      '<circle cx="50" cy="56" r="24" fill="' + skin + '" stroke="#3A1F0F" stroke-width="3"/>' +
      (hairKey !== 'long' ? '<path d="' + HAIR[hairKey] + '" fill="' + hair + '" stroke="#3A1F0F" stroke-width="3" stroke-linejoin="round"/>' : '<path d="M22 44q-4-30 28-32 32 2 28 32-6-14-16-16-6 12-24 8-8 8-16 8z" fill="' + hair + '" stroke="#3A1F0F" stroke-width="3" stroke-linejoin="round"/>') +
      '<g fill="#3A1F0F"><circle cx="41" cy="57" r="3"/><circle cx="59" cy="57" r="3"/></g>' +
      '<g fill="#FFF"><circle cx="42" cy="56" r="1"/><circle cx="60" cy="56" r="1"/></g>' +
      '<path class="brow" d="' + BROW.happy + '" stroke="#3A1F0F" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<g fill="#F7A1A1" opacity=".6"><circle cx="34" cy="64" r="4"/><circle cx="66" cy="64" r="4"/></g>' +
      '<path class="mouth" d="' + MOUTH.happy + '" stroke="#B0402E" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '</svg>';
  }
  function mood(el, m) {
    var mo = el.querySelector('.mouth'), br = el.querySelector('.brow');
    if (mo) mo.setAttribute('d', MOUTH[m] || MOUTH.happy);
    if (br) br.setAttribute('d', BROW[m] || BROW.happy);
  }
  window.CKArt = { SPRITE: SPRITE, icon: icon, character: character, mood: mood };
})();
