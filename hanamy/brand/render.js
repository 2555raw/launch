/* Renders the brand header at the sizes the outside world asks for. The
 * page is the same photograph, palette and type as the site, so the banner
 * cannot drift away from what it is advertising. */
const { chromium } = require("/home/user/launch/hydropad/node_modules/playwright-core");

// X lays the profile photo over the bottom-left of the header and crops the
// top and bottom on a phone, so that banner starts its text past the avatar
// and keeps it off the floor. The others have no such furniture.
const SIZES = [
  // name            w     h    title  body  mark  left  right  where the photo sits
  ["header-x",      1500,  500, 54,   17,   36,  270,   88,  "52% 58%"],
  ["header-og",     1200,  630, 66,   20,   42,   80,   80,  "52% 60%"],
  ["header-wide",   2400,  800, 98,   30,   64,  140,  140,  "52% 58%"],
  ["header-square", 1200, 1200, 82,   26,   56,   96,   96,  "50% 55%"],
];

(async () => {
  const fonts = process.argv[2];            // local Google-Fonts CSS
  const out = process.argv[3];
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  for (const [name, w, h, title, body, mark, padL, padR, pos] of SIZES) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await p.goto("file://" + __dirname + "/header.html");
    await p.evaluate(([fonts, w, h, title, body, mark, padL, padR, pos]) => {
      document.querySelector("link").href = fonts;
      document.getElementById("plate").style.cssText = `width:${w}px;height:${h}px`;
      document.querySelector("img").style.objectPosition = pos;
      // The scrim leans to the reading side so the type holds its contrast
      // over whatever the photograph happens to be doing there.
      document.getElementById("scrim").style.background =
        `linear-gradient(100deg, rgba(48,18,30,.90) 0%, rgba(48,18,30,.72) 30%,
                                 rgba(48,18,30,.26) 62%, rgba(48,18,30,.06) 100%)`;
      const inn = document.getElementById("in");
      inn.style.padding = `0 ${padR}px 0 ${padL}px`;
      inn.style.gap = Math.round(title * 0.26) + "px";
      document.querySelector(".mark").style.setProperty("--gap", Math.round(mark * 0.34) + "px");
      document.querySelectorAll(".mark svg").forEach((s) => {
        s.setAttribute("width", mark); s.setAttribute("height", mark);
      });
      document.getElementById("word").style.fontSize = Math.round(mark * 0.92) + "px";
      document.getElementById("kana").style.fontSize = Math.round(mark * 0.52) + "px";
      document.getElementById("rule").style.width = Math.round(title * 1.9) + "px";
      document.getElementById("h1").style.fontSize = title + "px";
      const par = document.getElementById("p");
      par.style.fontSize = body + "px";
      par.style.maxWidth = Math.round(body * 26) + "px";
    }, [fonts, w, h, title, body, mark, padL, padR, pos]);
    await p.waitForTimeout(2200);
    await p.screenshot({ path: `${out}/${name}.png` });
    console.log(`${name.padEnd(15)} ${w}x${h}`);
    await p.close();
  }
  await b.close();
})();
