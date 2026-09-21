/* Crypto Kitchen — drawn art, second pass: shaded, lit and textured. One SVG
   sprite of dishes (raw and cooked), kitchen props and scenery, plus cartoon
   customer busts built per customer so their mood can change. */
(function () {
  'use strict';
  var D = '<defs>' +
    '<filter id="fSh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="2.2" flood-color="#2A1245" flood-opacity=".4"/></filter>' +
    '<filter id="fBlur"><feGaussianBlur stdDeviation="2.5"/></filter>' +
    '<filter id="fGlow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
    '<radialGradient id="gBunT" cx=".38" cy=".3" r=".75"><stop offset="0" stop-color="#FFD98A"/><stop offset=".55" stop-color="#EBA43C"/><stop offset="1" stop-color="#B86F1C"/></radialGradient>' +
    '<linearGradient id="gBunB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3B65A"/><stop offset="1" stop-color="#B86F1C"/></linearGradient>' +
    '<radialGradient id="gPatty" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#8F4E28"/><stop offset=".7" stop-color="#5A2E12"/><stop offset="1" stop-color="#33180A"/></radialGradient>' +
    '<radialGradient id="gRaw" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#FF8A86"/><stop offset=".7" stop-color="#D14751"/><stop offset="1" stop-color="#8E2734"/></radialGradient>' +
    '<radialGradient id="gSteak" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#B9673A"/><stop offset=".7" stop-color="#7A3C18"/><stop offset="1" stop-color="#47200A"/></radialGradient>' +
    '<linearGradient id="gCup" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9AE4FF"/><stop offset=".35" stop-color="#4FC0F5"/><stop offset=".7" stop-color="#2E96DA"/><stop offset="1" stop-color="#1C6FB0"/></linearGradient>' +
    '<linearGradient id="gBox" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FF6A55"/><stop offset=".5" stop-color="#E23A2C"/><stop offset="1" stop-color="#A8211A"/></linearGradient>' +
    '<linearGradient id="gFry" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFE68A"/><stop offset=".5" stop-color="#FFC93A"/><stop offset="1" stop-color="#D99A1C"/></linearGradient>' +
    '<radialGradient id="gCrust" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#F6C776"/><stop offset=".75" stop-color="#D68F3A"/><stop offset="1" stop-color="#A05F1C"/></radialGradient>' +
    '<radialGradient id="gCheese" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#FFEFA8"/><stop offset=".7" stop-color="#FFD24D"/><stop offset="1" stop-color="#E8A82A"/></radialGradient>' +
    '<radialGradient id="gPep" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#E05A4E"/><stop offset=".7" stop-color="#B02A24"/><stop offset="1" stop-color="#6E1410"/></radialGradient>' +
    '<radialGradient id="gPlate" cx=".5" cy=".42" r=".62"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".72" stop-color="#F2F2F2"/><stop offset=".86" stop-color="#D5D5D5"/><stop offset="1" stop-color="#B9B9B9"/></radialGradient>' +
    '<radialGradient id="gYolk" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#FFF08A"/><stop offset=".6" stop-color="#FFB627"/><stop offset="1" stop-color="#E08A10"/></radialGradient>' +
    '<radialGradient id="gWhite" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".85" stop-color="#F7F7F2"/><stop offset="1" stop-color="#E2E0D5"/></radialGradient>' +
    '<linearGradient id="gGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FD95A"/><stop offset="1" stop-color="#3E8E2E"/></linearGradient>' +
    '<radialGradient id="gTom" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#FF7A62"/><stop offset=".7" stop-color="#E13A28"/><stop offset="1" stop-color="#9E1F12"/></radialGradient>' +
    '<linearGradient id="gPot" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#F08A5E"/><stop offset=".5" stop-color="#D9573B"/><stop offset="1" stop-color="#8E3320"/></linearGradient>' +
    '<radialGradient id="gLant" cx=".38" cy=".35" r=".8"><stop offset="0" stop-color="#FF8A6E"/><stop offset=".6" stop-color="#F0452F"/><stop offset="1" stop-color="#8C1A10"/></radialGradient>' +
    '<linearGradient id="gWood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#E4A363"/><stop offset=".5" stop-color="#C27A3A"/><stop offset="1" stop-color="#8B4F1E"/></linearGradient>' +
    '<linearGradient id="gGlass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FF7A62"/><stop offset=".45" stop-color="#E23B2E"/><stop offset="1" stop-color="#8E1A12"/></linearGradient>' +
    '<linearGradient id="gIce" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".5" stop-color="#CDEFFF"/><stop offset="1" stop-color="#8FD0F5"/></linearGradient>' +
    '<radialGradient id="gDough" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#FBF0CF"/><stop offset=".8" stop-color="#E8D3A0"/><stop offset="1" stop-color="#C9AE72"/></radialGradient>' +
    '<radialGradient id="gPotato" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#FFF4C2"/><stop offset=".8" stop-color="#F0DC8E"/><stop offset="1" stop-color="#C9B25A"/></radialGradient>' +
    '</defs>';

  var S = {};
  S['c-burger'] =
    '<ellipse cx="50" cy="93" rx="40" ry="6" fill="#000" opacity=".28" filter="url(#fBlur)"/>' +
    '<path d="M11 76q0-6 6-6h66q6 0 6 6v5q0 9-9 9H20q-9 0-9-9z" fill="url(#gBunB)" stroke="#6E3A0E" stroke-width="2.5"/>' +
    '<path d="M14 72h72" stroke="#FFE1A6" stroke-width="2" opacity=".6"/>' +
    '<path d="M9 64q7 9 15 1t14 1 14 0 14 0 14 0 12 0v9H9z" fill="url(#gGreen)" stroke="#2C6E22" stroke-width="2.5" stroke-linejoin="round"/>' +
    '<path d="M16 66q8 4 16-1M50 66q8 4 16-1" stroke="#C9F59C" stroke-width="2" fill="none" opacity=".7"/>' +
    '<rect x="13" y="50" width="74" height="15" rx="6" fill="url(#gPatty)" stroke="#2A1206" stroke-width="2.5"/>' +
    '<g stroke="#1B0B03" stroke-width="2.2" opacity=".55" stroke-linecap="round"><path d="M22 54l6 8M36 53l6 9M50 53l6 9M64 53l6 9"/></g>' +
    '<path d="M16 50h68l-6 9q-6 5-10-2-4 7-10 1-4 6-10 0-4 6-10 0-6 6-12-1z" fill="url(#gCheese)" stroke="#C98A00" stroke-width="2"/>' +
    '<g><ellipse cx="32" cy="47" rx="15" ry="5.5" fill="url(#gTom)" stroke="#7A1508" stroke-width="2"/><ellipse cx="68" cy="47" rx="15" ry="5.5" fill="url(#gTom)" stroke="#7A1508" stroke-width="2"/><ellipse cx="32" cy="47" rx="8" ry="2.5" fill="#FFB3A3" opacity=".7"/><ellipse cx="68" cy="47" rx="8" ry="2.5" fill="#FFB3A3" opacity=".7"/></g>' +
    '<path d="M9 45q0-31 41-33 41 2 41 33z" fill="url(#gBunT)" stroke="#6E3A0E" stroke-width="2.5"/>' +
    '<path d="M18 36q10-18 32-20" stroke="#FFF1C6" stroke-width="4" fill="none" stroke-linecap="round" opacity=".55"/>' +
    '<g fill="#FFF6D6" stroke="#D9A24A" stroke-width=".8"><ellipse cx="30" cy="30" rx="4" ry="2.2" transform="rotate(-20 30 30)"/><ellipse cx="46" cy="22" rx="4" ry="2.2" transform="rotate(10 46 22)"/><ellipse cx="63" cy="27" rx="4" ry="2.2" transform="rotate(25 63 27)"/><ellipse cx="38" cy="38" rx="4" ry="2.2" transform="rotate(5 38 38)"/><ellipse cx="56" cy="37" rx="4" ry="2.2" transform="rotate(-15 56 37)"/><ellipse cx="74" cy="38" rx="3.5" ry="2" transform="rotate(30 74 38)"/></g>';
  S['c-fries'] =
    '<ellipse cx="50" cy="93" rx="34" ry="5" fill="#000" opacity=".28" filter="url(#fBlur)"/>' +
    '<g stroke="#B57A0E" stroke-width="2" stroke-linejoin="round">' +
    '<rect x="28" y="6" width="11" height="52" rx="3" fill="url(#gFry)" transform="rotate(-16 33 32)"/><rect x="61" y="6" width="11" height="52" rx="3" fill="url(#gFry)" transform="rotate(16 66 32)"/>' +
    '<rect x="36" y="12" width="11" height="48" rx="3" fill="url(#gFry)" transform="rotate(-7 41 36)"/><rect x="53" y="12" width="11" height="48" rx="3" fill="url(#gFry)" transform="rotate(7 58 36)"/>' +
    '<rect x="44" y="2" width="12" height="58" rx="3" fill="url(#gFry)"/></g>' +
    '<g stroke="#FFF6C8" stroke-width="1.6" opacity=".8" stroke-linecap="round"><path d="M47 6v40M32 12l-4 34M68 12l4 34"/></g>' +
    '<path d="M17 44h66l-8 47H25z" fill="url(#gBox)" stroke="#6E120C" stroke-width="2.5" stroke-linejoin="round"/>' +
    '<path d="M17 44h66l-2 11H19z" fill="#FF9A88" opacity=".55"/>' +
    '<path d="M22 50l7 41" stroke="#FFB3A6" stroke-width="3" opacity=".5" stroke-linecap="round"/>' +
    '<path d="M38 62q12 12 24 0" stroke="#FFD54A" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M38 62q12 12 24 0" stroke="#FFF3B0" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".8"/>';
  S['c-steak'] =
    '<ellipse cx="50" cy="94" rx="44" ry="5" fill="#000" opacity=".3" filter="url(#fBlur)"/>' +
    '<ellipse cx="50" cy="68" rx="46" ry="25" fill="url(#gPlate)" stroke="#9A9A9A" stroke-width="2"/>' +
    '<ellipse cx="50" cy="68" rx="36" ry="17" fill="none" stroke="#FFFFFF" stroke-width="1.5" opacity=".8"/>' +
    '<path d="M19 57q-4-23 23-27 22-4 35 8 11 12 0 24-10 12-30 10-22-2-28-15z" fill="url(#gSteak)" stroke="#301406" stroke-width="2.5" stroke-linejoin="round"/>' +
    '<path d="M19 57q-2 12 8 16" stroke="#F2D8B8" stroke-width="6" fill="none" stroke-linecap="round" opacity=".9"/>' +
    '<g stroke="#1E0A03" stroke-width="3" stroke-linecap="round" opacity=".8"><path d="M28 43l36 3M25 53l40 4M30 63l30 2"/></g>' +
    '<g fill="#FFD2A6" opacity=".6"><ellipse cx="40" cy="38" rx="6" ry="2.5"/><ellipse cx="60" cy="48" rx="4" ry="2"/></g>' +
    '<path d="M62 60q14-8 26 0 10 8 0 14-12 6-26 0-8-6 0-14z" fill="url(#gWhite)" stroke="#D9D5C4" stroke-width="1.5"/>' +
    '<circle cx="75" cy="66" r="7.5" fill="url(#gYolk)" stroke="#D07E10" stroke-width="1.2"/><ellipse cx="72" cy="63" rx="2.5" ry="1.5" fill="#FFF9C2" opacity=".9"/>' +
    '<g stroke="#B57A0E" stroke-width="1.4"><rect x="10" y="60" width="5" height="20" rx="2" fill="url(#gFry)" transform="rotate(-24 12 70)"/><rect x="17" y="58" width="5" height="22" rx="2" fill="url(#gFry)" transform="rotate(-8 19 69)"/><rect x="24" y="61" width="5" height="19" rx="2" fill="url(#gFry)" transform="rotate(12 26 70)"/></g>' +
    '<path d="M52 78q6-6 12-2" stroke="#3E8E2E" stroke-width="2.5" fill="none" stroke-linecap="round"/><ellipse cx="58" cy="76" rx="4" ry="2" fill="url(#gGreen)" transform="rotate(-25 58 76)"/>';
  S['c-soda'] =
    '<ellipse cx="50" cy="94" rx="26" ry="4.5" fill="#000" opacity=".28" filter="url(#fBlur)"/>' +
    '<g transform="rotate(12 61 26)"><rect x="58" y="4" width="7" height="42" rx="3.5" fill="#E3412B" stroke="#8C1E12" stroke-width="1.5"/><path d="M58 10h7M58 18h7M58 26h7M58 34h7" stroke="#FFFFFF" stroke-width="3" opacity=".85"/></g>' +
    '<path d="M26 32h48l-5 55q-1 4-5 4H36q-4 0-5-4z" fill="url(#gCup)" stroke="#155A8C" stroke-width="2.5" stroke-linejoin="round"/>' +
    '<g fill="url(#gIce)" opacity=".75" stroke="#FFFFFF" stroke-width="1"><rect x="35" y="48" width="12" height="12" rx="3" transform="rotate(-10 41 54)"/><rect x="52" y="56" width="12" height="12" rx="3" transform="rotate(14 58 62)"/><rect x="42" y="66" width="11" height="11" rx="3"/></g>' +
    '<path d="M32 40l3 44" stroke="#FFFFFF" stroke-width="5" opacity=".45" stroke-linecap="round"/>' +
    '<g fill="#FFFFFF" opacity=".85"><circle cx="40" cy="44" r="1.6"/><circle cx="64" cy="50" r="1.3"/><circle cx="60" cy="76" r="1.5"/><circle cx="38" cy="80" r="1.2"/></g>' +
    '<path d="M22 24q28-10 56 0v8q-28-6-56 0z" fill="#FFFFFF" stroke="#155A8C" stroke-width="2.5" stroke-linejoin="round"/><path d="M28 22q22-8 44 0" stroke="#E6EEF5" stroke-width="3" fill="none"/>';
  S['c-pizza'] =
    '<ellipse cx="50" cy="94" rx="42" ry="5" fill="#000" opacity=".3" filter="url(#fBlur)"/>' +
    '<circle cx="50" cy="52" r="43" fill="url(#gCrust)" stroke="#7E4510" stroke-width="2.5"/>' +
    '<g fill="#7E4510" opacity=".35"><circle cx="24" cy="30" r="2"/><circle cx="72" cy="24" r="2.4"/><circle cx="86" cy="60" r="1.8"/><circle cx="30" cy="82" r="2.2"/><circle cx="66" cy="88" r="1.6"/></g>' +
    '<circle cx="50" cy="52" r="34" fill="#C7311F"/><circle cx="50" cy="52" r="31" fill="url(#gCheese)"/>' +
    '<g fill="#FFF7D0" opacity=".65"><circle cx="34" cy="52" r="3"/><circle cx="52" cy="66" r="2.5"/><circle cx="60" cy="30" r="2.2"/><circle cx="70" cy="66" r="2"/></g>' +
    '<g fill="url(#gPep)" stroke="#5A1008" stroke-width="1.2"><circle cx="37" cy="41" r="6.5"/><circle cx="60" cy="36" r="6.5"/><circle cx="66" cy="60" r="6.5"/><circle cx="43" cy="65" r="6.5"/><circle cx="52" cy="50" r="5.5"/></g>' +
    '<g fill="#FF9A8C" opacity=".55"><circle cx="35" cy="39" r="2"/><circle cx="58" cy="34" r="2"/><circle cx="64" cy="58" r="2"/><circle cx="41" cy="63" r="2"/></g>' +
    '<g fill="url(#gGreen)" stroke="#2C6E22" stroke-width="1"><ellipse cx="48" cy="32" rx="6" ry="3.2" transform="rotate(-25 48 32)"/><ellipse cx="72" cy="48" rx="6" ry="3.2" transform="rotate(15 72 48)"/><ellipse cx="32" cy="58" rx="6" ry="3.2" transform="rotate(35 32 58)"/></g>';
  S['r-burger'] =
    '<ellipse cx="50" cy="86" rx="34" ry="5" fill="#000" opacity=".25" filter="url(#fBlur)"/>' +
    '<ellipse cx="50" cy="58" rx="37" ry="25" fill="url(#gRaw)" stroke="#6E1620" stroke-width="2.5"/>' +
    '<g fill="#FFD9D6" opacity=".75"><ellipse cx="38" cy="50" rx="7" ry="3"/><ellipse cx="58" cy="64" rx="8" ry="3"/><ellipse cx="62" cy="49" rx="4" ry="2"/><ellipse cx="42" cy="66" rx="4" ry="1.8"/></g>' +
    '<ellipse cx="38" cy="44" rx="10" ry="4" fill="#FFFFFF" opacity=".35"/>';
  S['r-fries'] =
    '<ellipse cx="50" cy="90" rx="34" ry="5" fill="#000" opacity=".25" filter="url(#fBlur)"/>' +
    '<g stroke="#A88A2E" stroke-width="2"><rect x="22" y="40" width="15" height="44" rx="4" fill="url(#gPotato)" transform="rotate(-10 29 62)"/><rect x="63" y="40" width="15" height="44" rx="4" fill="url(#gPotato)" transform="rotate(10 70 62)"/><rect x="42" y="34" width="16" height="50" rx="4" fill="url(#gPotato)"/></g>' +
    '<ellipse cx="50" cy="28" rx="24" ry="15" fill="#C8A268" stroke="#7E5E22" stroke-width="2.5"/><g fill="#8C6A2C" opacity=".6"><circle cx="40" cy="26" r="1.5"/><circle cx="56" cy="32" r="1.5"/><circle cx="50" cy="22" r="1.2"/></g><ellipse cx="42" cy="22" rx="8" ry="3" fill="#FFF" opacity=".3"/>';
  S['r-steak'] =
    '<ellipse cx="50" cy="86" rx="38" ry="5" fill="#000" opacity=".25" filter="url(#fBlur)"/>' +
    '<path d="M19 57q-4-23 23-27 22-4 35 8 11 12 0 24-10 12-30 10-22-2-28-15z" fill="url(#gRaw)" stroke="#6E1620" stroke-width="2.5" stroke-linejoin="round"/>' +
    '<g stroke="#FFEDEA" stroke-width="3" fill="none" stroke-linecap="round" opacity=".85"><path d="M30 42q14 4 30-1M27 55q16 6 36 0M34 66q10 3 22 0"/></g>' +
    '<path d="M19 57q-2 14 14 18" stroke="#FFF6F2" stroke-width="7" fill="none" stroke-linecap="round"/>' +
    '<ellipse cx="42" cy="40" rx="10" ry="4" fill="#FFFFFF" opacity=".35"/>';
  S['r-soda'] =
    '<g fill="url(#gIce)" stroke="#6FC2EC" stroke-width="2"><rect x="18" y="42" width="30" height="30" rx="6" transform="rotate(-8 33 57)"/><rect x="52" y="36" width="30" height="30" rx="6" transform="rotate(10 67 51)"/><rect x="36" y="60" width="28" height="28" rx="6"/></g>' +
    '<g stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity=".95"><path d="M24 48l9-2M58 42l9-2M42 66l8-1"/></g>' +
    '<g fill="#4FA8E0" opacity=".25"><path d="M20 66l24 4-2 4-22-4z"/><path d="M56 60l24 4-2 4-22-4z"/></g>';
  S['r-pizza'] =
    '<ellipse cx="50" cy="92" rx="38" ry="5" fill="#000" opacity=".25" filter="url(#fBlur)"/>' +
    '<circle cx="50" cy="54" r="40" fill="url(#gDough)" stroke="#B4924A" stroke-width="2.5"/><circle cx="50" cy="54" r="31" fill="#E4CD94"/>' +
    '<circle cx="50" cy="54" r="24" fill="#D6382B" opacity=".55"/><g fill="#FFFFFF" opacity=".5"><circle cx="34" cy="34" r="2"/><circle cx="66" cy="30" r="1.5"/><circle cx="72" cy="70" r="2"/></g>';
  S.plant =
    '<ellipse cx="50" cy="96" rx="26" ry="4" fill="#000" opacity=".3" filter="url(#fBlur)"/>' +
    '<path d="M30 68h40l-5 26H35z" fill="url(#gPot)" stroke="#6E2214" stroke-width="2.5" stroke-linejoin="round"/><rect x="26" y="62" width="48" height="10" rx="4" fill="#F2865E" stroke="#6E2214" stroke-width="2.5"/><path d="M34 74l2 16" stroke="#FFC4AE" stroke-width="3" opacity=".6" stroke-linecap="round"/>' +
    '<g fill="url(#gGreen)" stroke="#1F6E2C" stroke-width="2" stroke-linejoin="round"><path d="M50 62q-32-8-28-42 24 6 28 42z"/><path d="M50 62q32-8 28-42-24 6-28 42z"/><path d="M50 62q-8-32 0-50 8 18 0 50z"/></g>' +
    '<g stroke="#D8F7B0" stroke-width="1.5" fill="none" opacity=".8"><path d="M50 60q-16-14-22-34M50 60q16-14 22-34M50 60V16"/></g>';
  S.lantern =
    '<rect x="46" y="4" width="8" height="14" fill="#F2C14E"/><rect x="34" y="16" width="32" height="8" rx="3" fill="#F2C14E" stroke="#8A5A00" stroke-width="2"/>' +
    '<circle cx="50" cy="52" r="31" fill="#FF6A3A" opacity=".45" filter="url(#fGlow)"/>' +
    '<circle cx="50" cy="52" r="30" fill="url(#gLant)" stroke="#7A160C" stroke-width="2.5"/>' +
    '<g stroke="#A82418" stroke-width="2.2" fill="none" opacity=".8"><path d="M34 26q-8 26 0 52M50 22v60M66 26q8 26 0 52M22 40q28-6 56 0M22 64q28 6 56 0"/></g>' +
    '<ellipse cx="38" cy="38" rx="8" ry="5" fill="#FFFFFF" opacity=".35"/>' +
    '<rect x="34" y="78" width="32" height="8" rx="3" fill="#F2C14E" stroke="#8A5A00" stroke-width="2"/><path d="M44 86v10M50 86v12M56 86v10" stroke="#F2C14E" stroke-width="3" stroke-linecap="round"/>';
  S.chair =
    '<rect x="30" y="10" width="40" height="44" rx="6" fill="url(#gWood)" stroke="#5E3010" stroke-width="2.5"/><rect x="22" y="50" width="56" height="14" rx="5" fill="#E8964C" stroke="#5E3010" stroke-width="2.5"/>' +
    '<path d="M28 64v30M72 64v30M34 22h32M34 34h32" stroke="#5E3010" stroke-width="4" stroke-linecap="round"/><path d="M36 14v36" stroke="#FFD9A8" stroke-width="2" opacity=".5"/>';
  S.jar =
    '<rect x="28" y="10" width="44" height="14" rx="4" fill="#3A3A3A" stroke="#111" stroke-width="2.5"/><path d="M32 13h36" stroke="#8A8A8A" stroke-width="2"/>' +
    '<path d="M22 24h56q6 0 6 8v50q0 12-12 12H28q-12 0-12-12V32q0-8 6-8z" fill="url(#gGlass)" stroke="#6E120C" stroke-width="2.5"/>' +
    '<rect x="30" y="42" width="40" height="30" rx="4" fill="#FFF6E0" stroke="#6E120C" stroke-width="1.5"/><path d="M36 50h28M36 58h20M36 66h24" stroke="#E23B2E" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M25 30q0 44 4 58" stroke="#FFFFFF" stroke-width="5" opacity=".4" stroke-linecap="round"/>';
  S.chef =
    '<path d="M20 40q-8-24 14-26 6-14 22-8 18-6 24 10 18 6 6 24H20z" fill="#FFFFFF" stroke="#8A4A1E" stroke-width="2.5"/><path d="M28 20q8-8 20-6" stroke="#E6E6E6" stroke-width="3" fill="none" stroke-linecap="round"/>' +
    '<rect x="24" y="36" width="52" height="10" rx="2" fill="#F1F1F1" stroke="#8A4A1E" stroke-width="2.5"/>' +
    '<circle cx="50" cy="62" r="21" fill="#FFD9B3" stroke="#8A4A1E" stroke-width="2.5"/><ellipse cx="42" cy="54" rx="8" ry="5" fill="#FFF" opacity=".35"/>' +
    '<g fill="#3A1F0F"><circle cx="43" cy="61" r="2.6"/><circle cx="57" cy="61" r="2.6"/></g><g fill="#FFF"><circle cx="44" cy="60" r=".9"/><circle cx="58" cy="60" r=".9"/></g>' +
    '<path d="M42 70q8 7 16 0" stroke="#B0402E" stroke-width="2.5" fill="none" stroke-linecap="round"/><g fill="#F7A1A1" opacity=".5"><circle cx="35" cy="66" r="3.5"/><circle cx="65" cy="66" r="3.5"/></g>' +
    '<path d="M28 100q4-18 22-18t22 18z" fill="#FFFFFF" stroke="#8A4A1E" stroke-width="2.5"/><path d="M44 86h12" stroke="#E3412B" stroke-width="4"/>';

  var SPRITE = '<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">' + D +
    Object.keys(S).map(function (k) { return '<symbol id="' + k + '" viewBox="0 0 100 100">' + S[k] + '</symbol>'; }).join('') + '</svg>';

  function icon(name, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#' + name + '"/></svg>'; }

  // ---- customers: cartoon busts, shaded ----
  var HAIR = {
    bob:   { back: 'M20 50q-6-36 30-38 36 2 30 38l-4 26h-6l-2-24q-18-10-36 0l-2 24h-6z', front: 'M22 46q-4-32 28-34 32 2 28 34-6-16-16-18-6 12-24 8-8 8-16 10z' },
    short: { front: 'M24 42q0-28 26-28t26 28q-8-12-26-12T24 42z' },
    bun:   { front: 'M26 42q0-24 24-26 24 2 24 26-6-10-24-10t-24 10zM38 16a12 12 0 1 1 24 0 12 12 0 0 1-24 0z' },
    long:  { back: 'M18 50q-2-38 32-40 34 2 32 40l-6 40h-8l-2-38q-16-6-32 0l-2 38h-8z', front: 'M22 46q-4-32 28-34 32 2 28 34-6-16-16-18-6 12-24 8-8 8-16 10z' },
    bald:  { front: 'M30 38q4-16 20-16t20 16q-10-8-20-8t-20 8z' },
    curly: { front: 'M20 46a10 10 0 0 1 8-16 12 12 0 0 1 22-8 12 12 0 0 1 22 8 10 10 0 0 1 8 16q-8-10-30-10t-30 10z' },
    cap:   { front: 'M22 44q0-28 28-28t28 28l12 2v6H12v-6z', extra: '<path d="M22 44q28-6 56 0" stroke="#FFFFFF" stroke-width="3" fill="none" opacity=".5"/>' }
  };
  var SKIN = [['#FFE1C4', '#F2B98F'], ['#F5CFA8', '#DDA173'], ['#E4B287', '#BF8452'], ['#C98D5E', '#9A6236'], ['#9A6437', '#6E4322'], ['#FFD6C9', '#EFA58E']];
  var HAIRC = [['#4A2B14', '#2A160A'], ['#C8652F', '#8E3F14'], ['#F2D27C', '#C89A34'], ['#F6F6F6', '#C9C9C9'], ['#8A3A9C', '#5A2166'], ['#2A2A2A', '#0F0F0F'], ['#E24E2B', '#9E2D12'], ['#3B6FD6', '#22448C']];
  var SHIRT = [['#5EE0DA', '#1F9E98'], ['#FF6B5E', '#B7261F'], ['#A07CF0', '#5A32B8'], ['#FFA64D', '#D9651A'], ['#6EE58F', '#25A04A'], ['#FF7DB8', '#C7307A'], ['#5B9BEA', '#1F5FB8'], ['#FFD24D', '#D99B12']];
  var MOUTH = { happy: 'M40 67q10 10 20 0', ok: 'M42 69h16', angry: 'M40 71q10-9 20 0' };
  var BROW = { happy: 'M35 50q5-4 11-2M54 48q6-2 11 2', ok: 'M35 49h11M54 49h11', angry: 'M35 45l11 5M54 50l11-5' };
  function rnd(a) { return a[Math.floor(Math.random() * a.length)]; }
  var uid = 0;
  function character() {
    var id = 'ch' + (++uid), hk = rnd(Object.keys(HAIR)), h = HAIR[hk], skin = rnd(SKIN), hair = rnd(HAIRC), shirt = rnd(SHIRT);
    var g = '<defs><radialGradient id="' + id + 's" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="' + skin[0] + '"/><stop offset="1" stop-color="' + skin[1] + '"/></radialGradient>' +
      '<linearGradient id="' + id + 'h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + hair[0] + '"/><stop offset="1" stop-color="' + hair[1] + '"/></linearGradient>' +
      '<linearGradient id="' + id + 't" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + shirt[0] + '"/><stop offset="1" stop-color="' + shirt[1] + '"/></linearGradient></defs>';
    return '<svg class="char" viewBox="0 0 100 112" aria-hidden="true">' + g +
      (h.back ? '<path d="' + h.back + '" fill="url(#' + id + 'h)" stroke="#2A160A" stroke-width="2.5" stroke-linejoin="round"/>' : '') +
      '<path d="M16 112q0-30 34-30t34 30z" fill="url(#' + id + 't)" stroke="#2A160A" stroke-width="2.5"/>' +
      '<path d="M22 100q6-10 16-12M78 100q-6-10-16-12" stroke="#000" stroke-width="2" opacity=".18" fill="none" stroke-linecap="round"/>' +
      '<rect x="43" y="72" width="14" height="14" fill="' + skin[1] + '" stroke="#2A160A" stroke-width="2.5"/>' +
      '<path d="M38 84q12 8 24 0" fill="#FFFFFF" stroke="#2A160A" stroke-width="2"/>' +
      '<ellipse cx="27" cy="58" rx="5" ry="6" fill="url(#' + id + 's)" stroke="#2A160A" stroke-width="2.5"/><ellipse cx="73" cy="58" rx="5" ry="6" fill="url(#' + id + 's)" stroke="#2A160A" stroke-width="2.5"/>' +
      '<circle cx="50" cy="56" r="25" fill="url(#' + id + 's)" stroke="#2A160A" stroke-width="2.5"/>' +
      '<ellipse cx="40" cy="44" rx="10" ry="6" fill="#FFFFFF" opacity=".28"/>' +
      '<path d="' + h.front + '" fill="url(#' + id + 'h)" stroke="#2A160A" stroke-width="2.5" stroke-linejoin="round"/>' +
      (h.extra || '<path d="M30 30q10-10 24-8" stroke="#FFFFFF" stroke-width="3" fill="none" stroke-linecap="round" opacity=".35"/>') +
      '<g fill="#FFFFFF"><ellipse cx="41" cy="58" rx="5" ry="5.5"/><ellipse cx="59" cy="58" rx="5" ry="5.5"/></g>' +
      '<g fill="#3B5FA8"><circle cx="41.5" cy="58.5" r="3.2"/><circle cx="59.5" cy="58.5" r="3.2"/></g><g fill="#0E0E0E"><circle cx="41.5" cy="58.5" r="1.8"/><circle cx="59.5" cy="58.5" r="1.8"/></g><g fill="#FFF"><circle cx="43" cy="57" r="1.1"/><circle cx="61" cy="57" r="1.1"/></g>' +
      '<path class="brow" d="' + BROW.happy + '" stroke="#2A160A" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
      '<path d="M50 60q-3 5 1 7" stroke="' + skin[1] + '" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<g fill="#F77F8A" opacity=".45"><circle cx="33" cy="66" r="4.5"/><circle cx="67" cy="66" r="4.5"/></g>' +
      '<path class="mouth" d="' + MOUTH.happy + '" stroke="#9E3A2E" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
      '</svg>';
  }
  function mood(el, m) {
    var mo = el.querySelector('.mouth'), br = el.querySelector('.brow');
    if (mo) mo.setAttribute('d', MOUTH[m] || MOUTH.happy);
    if (br) br.setAttribute('d', BROW[m] || BROW.happy);
  }
  window.CKArt = { SPRITE: SPRITE, icon: icon, character: character, mood: mood };
})();
