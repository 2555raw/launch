#!/usr/bin/env python3
"""Writes the static pages. The bar, the footer and the head are one
definition here so the four pages cannot drift apart."""
import pathlib, re

MARK = ('<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">'
        '<g fill="currentColor">'
        '<ellipse cx="12" cy="6" rx="2.7" ry="4.3"/>'
        '<ellipse cx="12" cy="6" rx="2.7" ry="4.3" transform="rotate(72 12 12)"/>'
        '<ellipse cx="12" cy="6" rx="2.7" ry="4.3" transform="rotate(144 12 12)"/>'
        '<ellipse cx="12" cy="6" rx="2.7" ry="4.3" transform="rotate(216 12 12)"/>'
        '<ellipse cx="12" cy="6" rx="2.7" ry="4.3" transform="rotate(288 12 12)"/>'
        '</g><circle cx="12" cy="12" r="1.5" fill="#47202e" opacity=".35"/></svg>')
AR = ('<svg class="ar" width="16" height="16" viewBox="0 0 24 24" fill="none" '
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">'
      '<path d="M5 12h13M12 5l7 7-7 7"/></svg>')
CV = ('<svg class="cv" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
      'stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>')

def head(title, desc, extra=""):
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@500;700&family=Zen+Kaku+Gothic+Antique:wght@400;500;700&family=M+PLUS+1+Code:wght@400;500&family=Yuji+Syuku&display=swap">
<link rel="stylesheet" href="styles.css">
{extra}</head>
<body>
"""

MENUS = {
    "Platform": [
        ("Console", "models.html", "The register, and what each model costs"),
        ("Playground", "index.html#curiosity", "One prompt, two models, side by side"),
        ("Render", "index.html#curiosity", "Turn an answer into something to look at"),
        ("Models", "models.html", "Everything reachable through the endpoint"),
    ],
    "Tsubomi": [
        ("Meet Tsubomi", "docs.html#tsubomi", "Talk an idea into an agent brief"),
        ("Agent briefs", "docs.html#tsubomi", "Mission, research skills, a character"),
        ("CLI documentation", "docs.html#cli", "The same key, in your terminal"),
    ],
    "Community": [
        ("Commons", "staking.html", "Where the pool is discussed"),
        ("Roadmap", "staking.html#mip", "Proposals, and what is being built"),
        ("Ledger", "staking.html#ledger", "Published usage and pool reporting"),
    ],
}

ICON = {
    "Platform":  '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
    "Tsubomi":  '<path d="M12 21V9"/><path d="M12 9c0-3 2-5 5-5 0 3-2 5-5 5z"/><path d="M12 12c0-3-2-5-5-5 0 3 2 5 5 5z"/>',
    "Community": '<circle cx="9" cy="9" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 6.5a3 3 0 0 1 0 5.8M17.5 20a6 6 0 0 0-3-5.2"/>',
    "Rewards":   '<path d="M12 4l2.3 4.7 5.2.8-3.7 3.6.9 5.1-4.7-2.4-4.7 2.4.9-5.1L4.5 9.5l5.2-.8z"/>',
    "Docs":      '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/>',
    "Account":   '<circle cx="12" cy="8" r="3.2"/><path d="M5 20a7 7 0 0 1 14 0"/>',
}

def svg(name, size=20):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" '
            f'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" '
            f'stroke-linejoin="round" aria-hidden="true">{ICON[name]}</svg>')

NAV = [("Platform", None), ("Tsubomi", None), ("Community", None),
       ("Rewards", "staking.html"), ("Docs", "docs.html")]

def rail(active=""):
    """The whole navigation, as a rail. An icon with a group opens the same
    panel the bar used to; an icon without one is a plain link."""
    out = [f'<a class="mark" href="index.html">{MARK}'
           f'<span class="lbl wordmark">Hanami</span></a>']
    for label, href in NAV:
        on = ' on' if label.lower() == active else ''
        if href is None:
            mid = label.lower()
            items = "".join(
                f'<a href="{h}" role="menuitem"><b>{t}</b><span>{d}</span></a>'
                for t, h, d in MENUS[label])
            out.append(
                f'<div class="menu"><button type="button" class="ri{on}" aria-haspopup="true" '
                f'aria-expanded="false" aria-controls="m-{mid}">{svg(label)}'
                f'<span class="lbl">{label}</span>'
                f'<svg class="cv" width="12" height="12" viewBox="0 0 24 24" fill="none" '
                f'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" '
                f'aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>'
                f'<div class="pop" id="m-{mid}" role="menu" hidden>'
                f'<h6>{label}</h6>{items}</div></div>')
        else:
            out.append(f'<a class="ri{on}" href="{href}">{svg(label)}'
                       f'<span class="lbl">{label}</span></a>')
    out.append('<span class="gap"></span>')
    out.append(f'<a class="ri" href="staking.html">{svg("Account")}'
               f'<span class="lbl">Your account</span></a>')
    return '<nav class="rail" aria-label="Main">' + "".join(out) + '</nav>'

def drawer():
    """The same links, flattened, for a screen too narrow for a rail."""
    d = ""
    for label, href in NAV:
        if href is None:
            d += f'<h6>{label}</h6>' + "".join(
                f'<a href="{u}">{n}</a>' for n, u, _ in MENUS[label])
        else:
            d += f'<a class="solo" href="{href}">{label}</a>'
    d += '<a class="solo" href="staking.html">Your account</a>'
    return (f'<div class="railbar"><a class="brand" href="index.html">{MARK} Hanami</a>'
            f'<button class="burger" type="button" id="burger" aria-expanded="false" '
            f'aria-controls="drawer" aria-label="Menu">'
            f'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="1.8" stroke-linecap="round" aria-hidden="true">'
            f'<path d="M4 7h16M4 12h16M4 17h16"/></svg></button></div>'
            f'<div class="drawer" id="drawer" hidden>{d}</div>')

def top(active=""):
    """Opens the page shell: the rail, then the column everything else sits in."""
    return f'<div class="shell">\n{rail(active)}\n<div class="col">\n{drawer()}\n'

SHELL_END = "</div>\n</div>\n"

FOOT = f"""{SHELL_END}<footer class="foot"><div class="wrap">
  <div class="foot-grid">
    <div>
      <div class="brand">{MARK} Hanami</div>
    </div>
    <div><h4>Platform</h4><ul>
      <li><a href="models.html">Console</a></li>
      <li><a href="index.html#compare">Playground</a></li>
      <li><a href="index.html#compare">Render</a></li>
      <li><a href="models.html">Models</a></li>
    </ul></div>
    <div><h4>Build</h4><ul>
      <li><a href="docs.html">Tsubomi</a></li>
      <li><a href="docs.html#cli">CLI documentation</a></li>
      <li><a href="docs.html#keys">API keys</a></li>
    </ul></div>
    <div><h4>Community</h4><ul>
      <li><a href="staking.html">Commons</a></li>
      <li><a href="staking.html#mip">Roadmap</a></li>
      <li><a href="staking.html#ledger">Ledger</a></li>
    </ul></div>
    <div><h4>Resources</h4><ul>
      <li><a href="docs.html">Documentation</a></li>
      <li><a href="docs.html#notes">Field Notes</a></li>
      <li><a href="staking.html">Your account</a></li>
    </ul></div>
  </div>

  <dl class="spec">
    <div><dt>Interface</dt><dd>OpenAI-compatible /v1</dd></div>
    <div><dt>Base URL</dt><dd>api.hanami.dev/v1</dd></div>
    <div><dt>Auth</dt><dd>Bearer · wallet-scoped</dd></div>
    <div><dt>Streaming</dt><dd>SSE · text/event-stream</dd></div>
    <div><dt>Chain</dt><dd>Robinhood Chain · 4663</dd></div>
    <div><dt>Settlement</dt><dd>WETH</dd></div>
    <div><dt>Token</dt><dd>$HANA</dd></div>
    <div><dt>Limits</dt><dd>per wallet · burst-tolerant</dd></div>
  </dl>

  <div class="rule">
    <span>&copy; <span data-year>2026</span> Hanami</span>
    <span class="mid">Looking is free.</span>
    <a href="#" id="totop">Back to top &nbsp;&uarr;</a>
  </div>
</div></footer>
<script src="data.js"></script>
<script src="app.js"></script>
</body>
</html>
"""

# ---------------------------------------------------------------- index
index = head("Hanami · Every model, one look",
             "Explore every model, compare answers side by side, and build with the ones you "
             "choose — one wallet-scoped key, one endpoint.",
             '') + top("index") + f"""
<section class="hero">
  <div class="frame">
    <picture>
      <source media="(max-width: 760px)" srcset="media/hero-tall.webp">
      <img id="heroimg" src="media/hero-wide.webp"
           alt="Cherry trees in full blossom over the vermilion halls of a Japanese temple">
    </picture>
    <canvas id="grove" hidden aria-label="An engraving of a cherry grove over a river"></canvas>
    <div class="over"><div class="wrap">
      <h1>Every model.<br>One look.</h1>
      <p>Put one prompt in front of every frontier model and read the answers side by side. Hanami is going out to look at the blossom — looking costs nothing.</p>
      <div class="cta">
        <a class="btn pale" href="#curiosity">Ask Tsubomi {AR}</a>
        <a class="btn on-dark" href="docs.html">Learn More {AR}</a>
      </div>
    </div></div>
  </div>
</section>

<section class="band dark"><div class="wrap">
  <div class="split">
    <div class="stack">
      <h2>From your first question<br>to your next big idea.</h2>
      <h3 style="margin-top:18px">Your tools. Your models.<br>Your way to build.</h3>
      <p>Connect your apps and tools with a revocable client key. Choose your models and manage
        access in one place.</p>
      <div class="cta" style="display:flex;gap:12px;flex-wrap:wrap">
        <a class="btn pale" href="models.html">Explore the platform {AR}</a>
      </div>
      <a class="link" style="color:var(--on-dark)" href="docs.html">Read the documentation {AR}</a>
    </div>
    <div class="dia">
      <div class="node">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/></svg>
        Your app <span style="margin-left:auto"></span>
        <span style="width:7px;height:7px;border-radius:50%;background:var(--blossom)"></span>
      </div>
      <div class="wire"></div>
      <div class="node key">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="8" cy="12" r="3.2"/><path d="M11 12h9M17 12v3"/></svg>
        Client key
        <span class="ok"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M5 13l4 4 10-10"/></svg> Active</span>
      </div>
      <div class="wire"></div>
      <div class="fan">
        <div class="leaf">For code</div>
        <div class="leaf mid">Your choice</div>
        <div class="leaf">For ideas</div>
      </div>
    </div>
  </div>

  <div class="split" style="margin-top:100px">
    <div class="stack">
      <h2>An idea is enough<br>to get started.</h2>
      <p>Talk it through with Tsubomi. Build an agent brief with a
        mission, research skills, and a character of its own.</p>
      <a class="btn pale" href="docs.html#tsubomi">Meet Tsubomi {AR}</a>
    </div>
    <div class="chat">
      <div class="me">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>
        <div><b style="font-weight:600">You</b><br>Compare the task we&#39;re working on across 7 relevant models</div>
      </div>
      <div class="cols">
        <div class="col" style="height:58px">Model 1<br>Starts from the core constraint</div>
        <div class="col" style="height:74px">Model 2<br>Asks what the reader already knows</div>
        <div class="col" style="height:92px">Model 3<br>Answers, then names what it assumed</div>
        <div class="col" style="height:70px">Model 4<br>Replies in one paragraph, no preamble</div>
        <div class="col" style="height:84px">Model 5<br>Walks the mechanism step by step</div>
      </div>
    </div>
  </div>
</div></section>

<section class="band light" id="curiosity"><div class="wrap">
  <h2 style="max-width:18ch">Follow your curiosity.<br>See where it takes you.</h2>
  <div class="split" style="margin-top:56px">
    <div>
      <div class="rows">
        <a href="#curiosity"><span class="t">Compare responses</span>{AR}</a>
        <div class="row"><span class="t" style="color:var(--ink-3)">Create something visual</span></div>
      </div>
      <p class="lede" style="margin-top:26px">Send one prompt to two models you choose. Read their
        answers side by side and decide what works for you.</p>
      <a class="link" style="margin-top:22px" href="models.html">Open Dispatch {AR}</a>
    </div>
    <div class="panel">
      <div class="split tight" style="gap:22px">
        <div class="field">
          <label for="modelA">Model A</label>
          <span class="prov" id="provA">&nbsp;</span>
          <select id="modelA"></select>
        </div>
        <div class="field">
          <label for="modelB">Model B</label>
          <span class="prov" id="provB">&nbsp;</span>
          <select id="modelB"></select>
        </div>
      </div>
      <div class="field" style="margin-top:22px">
        <label for="compare-q">What are you curious about?</label>
        <textarea id="compare-q" placeholder="Ask a question. Explore two perspectives."></textarea>
      </div>
      <div class="foot">
        <span class="sub">Free to try. No wallet needed.</span>
        <span class="far"><button class="btn line" type="button" id="compare-go">Compare responses {AR}</button></span>
      </div>
      <p class="sub" id="compare-msg" hidden style="margin-top:14px"></p>

      <div class="wire-up" id="wire" hidden>
        <p class="sub" style="margin-bottom:12px">Point this at any OpenAI-compatible endpoint.
          The key is kept in this browser only — it is never sent anywhere but the endpoint you
          name here.</p>
        <div class="split tight" style="gap:16px">
          <div class="field"><label for="w-base">Base URL</label>
            <input type="text" id="w-base" placeholder="https://api.openai.com/v1"></div>
          <div class="field"><label for="w-key">API key</label>
            <input type="password" id="w-key" placeholder="sk-…" autocomplete="off"></div>
        </div>
        <div class="foot">
          <button class="btn fill sm" type="button" id="w-save">Save and load models</button>
          <button class="btn line sm" type="button" id="w-clear">Forget</button>
          <span class="sub" id="w-state" style="margin-left:auto"></span>
        </div>
      </div>
      <p style="margin-top:12px"><button class="link" type="button" id="w-toggle"
        style="background:none;border:0;padding:0;cursor:pointer;font-size:13px">Use your own
        endpoint</button></p>

      <div class="answers" id="answers" hidden>
        <div class="ans"><h4 id="ans-a-name">Model A</h4><div class="body" id="ans-a"></div>
          <div class="meta" id="ans-a-meta"></div></div>
        <div class="ans"><h4 id="ans-b-name">Model B</h4><div class="body" id="ans-b"></div>
          <div class="meta" id="ans-b-meta"></div></div>
      </div>
    </div>
  </div>
</div></section>

<section class="plate">
  <img src="media/grove.webp" alt="A path running under cherry trees in full blossom">
  <div class="plate-in"><div class="wrap">
    <p class="kicker">Hanami · 花見</p>
    <h2>Going out to look<br>at the blossom.</h2>
    <p>That is what the word means, and what the free half of this is: you walk the row, you
      look, you decide. Nobody asks for a key at the gate.</p>
  </div></div>
</section>

<section class="band dark"><div class="wrap">
  <div class="split">
    <div class="stack">
      <h2>Shared access.<br>More ways forward.</h2>
      <p>Hanami makes AI easier to explore and use. Start with a free web comparison, then
        connect a wallet to create client keys for the shared inference pool.</p>
      <p>Access follows wallet-scoped fair-use limits. Explore the catalog,
        see how the pool is used, and help shape what we build next.</p>
      <a class="btn pale" href="models.html">Explore the models {AR}</a>
    </div>
    <div class="biglist">
      <a href="docs.html#limits"><span><span class="t">Understand your access</span>
        <span class="d">Guides, setup, and fair-use limits</span></span>{AR}</a>
      <a href="staking.html#ledger"><span><span class="t">Follow the shared pool</span>
        <span class="d">Published usage and pool reporting</span></span>{AR}</a>
      <a href="staking.html#mip"><span><span class="t">Have a say in what comes next</span>
        <span class="d">Roadmap, proposals, and community</span></span>{AR}</a>
    </div>
  </div>
</div></section>

<section class="band light"><div class="wrap">
  <h2 style="max-width:12ch">So many ways<br>to make it yours.</h2>
  <div class="cta" style="display:flex;gap:12px;flex-wrap:wrap;margin-top:36px">
    <a class="btn fill" href="#curiosity">Start exploring {AR}</a>
    <a class="btn line" href="docs.html">Read the docs {AR}</a>
  </div>
</div></section>
<script src="art.js"></script>
""" + FOOT

# --------------------------------------------------------------- models
models = head("Hanami · The model register",
              "Every model reachable through the shared pool, with its context window and what a "
              "million tokens costs in each direction.") + top("models") + f"""
<section class="band light" style="padding-bottom:0"><div class="wrap">
  <p class="crumb"><a href="index.html">Hanami</a> / Platform / Models</p>
  <h1 style="font-size:clamp(38px,5vw,62px)">Every model,<br>in one register.</h1>
  <p class="lede" style="margin-top:22px">What is reachable through the endpoint right now, what it
    costs, and how much context it will hold. Model names here are the strings you pass in
    <code style="font-family:var(--mono);font-size:.85em">"model"</code> — they work as written.</p>
</div></section>

<section class="band light" style="padding-top:48px"><div class="wrap">
  <div class="filters" id="filters"></div>
  <div class="sheet">
    <table>
      <thead><tr>
        <th scope="col">Model</th><th scope="col">Lab</th>
        <th scope="col" class="r">Context</th>
        <th scope="col" class="r">In / 1M</th>
        <th scope="col" class="r">Out / 1M</th>
        <th scope="col">Status</th>
      </tr></thead>
      <tbody id="rows"></tbody>
    </table>
  </div>
  <p class="sub" id="tnote" style="margin-top:16px"></p>
</div></section>

<section class="band dark"><div class="wrap">
  <div class="split">
    <div class="stack">
      <h2>One endpoint,<br>every name above.</h2>
      <p>Change the base URL and the key. The request body, the streaming format and the tool calls
        stay exactly as your SDK already writes them.</p>
      <a class="btn pale" href="docs.html">Read the quickstart {AR}</a>
    </div>
    <div class="code">
      <div class="bar"><span>quickstart.sh</span><span class="far">
        <button type="button" data-copy="#snippet" aria-label="Copy">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 5H6a2 2 0 0 0-2 2v9"/></svg>
        </button></span></div>
<pre id="snippet"><span class="c"># one endpoint, every model in the register</span>
curl https://api.hanami.dev/v1/chat/completions \\
  -H <span class="s">"Authorization: Bearer $MW_CLIENT_KEY"</span> \\
  -H <span class="s">"Content-Type: application/json"</span> \\
  -d <span class="s">'{{
    "model": "claude-opus-5",
    "messages": [{{"role":"user","content":"say hi"}}],
    "stream": true
  }}'</span></pre>
    </div>
  </div>
</div></section>
""" + FOOT

# ----------------------------------------------------------------- docs
def side():
    def a(t, href, on=False):
        cls = ' class="on"' if on else ''
        return '<a href="%s"%s>%s</a>' % (href, cls, t)
    return f"""<aside class="side">
  <div class="toggle">
    <button type="button" aria-pressed="true">Hanami</button>
    <button type="button" aria-pressed="false">Tsubomi</button>
  </div>
  <nav>{a("Hanami platform overview", "#")}</nav>
  <h5>Start here</h5>
  <nav>
    {a("What is the Hanami platform?", "#", True)}
    {a("Get connected", "#keys")}
    {a("Why we&#39;re building Hanami", "#notes")}
  </nav>
  <h5>Work in your terminal</h5>
  <nav>
    {a("Hanami CLI", "#cli")}
    {a("OpenCode", "#cli")}
    {a("A deliberate local workflow", "#cli")}
  </nav>
  <h5>Connect an application</h5>
  <nav>
    {a("API keys", "#keys")}
    {a("First API request", "#first")}
    {a("Model discovery", "models.html")}
    {a("Streaming responses", "#first")}
    {a("Function tools &amp; conversations", "#first")}
  </nav>
  <h5>Control your requests</h5>
  <nav>
    {a("Client keys &amp; limits", "#limits")}
    {a("Errors", "#limits")}
  </nav>
</aside>"""

TAB = [
  ("Client key", "tp1", "A credential for one client.",
   "Your wallet identifies the member. A revocable client key authenticates the application and "
   "carries its saved defaults.",
   "Client key", "Authorization: Bearer $HANAMI_API_KEY"),
  ("Quiver", "tp2", "A limit that travels with the key.",
   "A quiver caps what one key may spend and reach: models allowed, tokens per day, requests per "
   "minute. Revoking the key revokes the quiver with it.",
   "Quiver", "x-mw-quiver: daily_tokens=2_000_000; rpm=60"),
  ("Model", "tp3", "The name is the routing decision.",
   "The string you pass in \"model\" is resolved against the register. Nothing is substituted "
   "behind your back — if a model is queued rather than live, the call fails loudly.",
   "Model", '"model": "claude-opus-5"'),
  ("Receipt", "tp4", "What the request actually cost.",
   "Every response carries a usage block: tokens in, tokens out, the model that served it and the "
   "wallet the usage was counted against.",
   "Receipt", '"usage": {"in": 812, "out": 1344, "wallet": "0x47d6…47cb"}'),
]
tabs_btns = "".join(
    f'<button type="button" role="tab" aria-selected="{"true" if i==0 else "false"}" '
    f'aria-controls="{t[1]}">{t[0]}</button>' for i, t in enumerate(TAB))
tabs_panels = "".join(f"""
<div id="{t[1]}" role="tabpanel"{"" if i==0 else " hidden"}>
  <div class="split tight" style="margin-top:26px">
    <div>
      <h3 style="font-size:23px">{t[2]}</h3>
      <p>{t[3]}</p>
      <a class="link" style="margin-top:18px" href="#keys">Read the guide {AR}</a>
    </div>
    <div class="code">
      <div class="bar"><span>{t[4]}</span><span class="far">
        <button type="button" data-text="{t[5]}" data-copy="#tc{i}" aria-label="Copy">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 5H6a2 2 0 0 0-2 2v9"/></svg>
        </button></span></div>
      <pre id="tc{i}">{t[5]}</pre>
    </div>
  </div>
</div>""" for i, t in enumerate(TAB))

docs = head("Hanami · Documentation",
            "The Hanami API, CLI and controls in one developer workflow.") + f"""
<div class="docs">
{rail("docs")}
{drawer()}
{side()}
<div>
  <div class="docbar">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/></svg>
    <b>Docs</b>
    <div class="docsearch">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>
      Search documentation… <kbd>&#8984; K</kbd>
    </div>
  </div>
  <main class="doc">
    <p class="crumb"><a href="docs.html">Docs</a> / <a href="docs.html">Hanami platform</a> / Start here</p>
    <h1>What is the Hanami platform?</h1>
    <p class="tagline">The Hanami API, CLI and controls in one developer workflow.</p>
    <p><button class="link" type="button" style="background:none;border:0;cursor:pointer;padding:0"
       data-copy="#md" data-label="Copy as Markdown">Copy as Markdown</button></p>
    <span id="md" hidden># What is the Hanami platform?

Hanami is the model routing platform. Explore models, compare responses, or connect directly
from your own tools. Client keys connect the work to your wallet; quivers and routing give you
control over how requests are allowed and routed.</span>
    <hr>
    <p>Hanami is the model routing platform. Explore models, compare responses, or connect
      directly from your own tools. Use the <a class="in" href="#cli">CLI</a> in your local
      workspace or send requests from your application. <a class="in" href="#keys">Client keys</a>
      connect the work to your wallet; limits and routing give you control over how requests are
      allowed and routed.</p>

    <h2 id="first">Choose your interface</h2>
    <p>The <a class="in" href="#cli">Hanami CLI</a> provides a terminal client with streamed
      responses, local file tools and explicit approval for writes and commands. The
      <a class="in" href="models.html">Responses API</a> lets your application own the interface,
      conversation state and tool execution.</p>

    <h2>One working path</h2>
    <p>Follow a request from its credential to its final receipt. Each stage answers a different
      operational question.</p>
    <div class="tabs" role="tablist" data-tabs>{tabs_btns}</div>
    {tabs_panels}
    <p class="sub" style="margin-top:22px">Interactive walkthrough · no requests are sent</p>

    <h2 id="keys">Controls that fit the work</h2>
    <p>Use a separate key for each integration so you can rotate or revoke it independently. A
      quiver limits what the key can use. Strategies describe supported routing choices; their
      availability depends on the deployment and the request path. A browser draft does not
      automatically become an API routing policy.</p>

    <h2 id="limits">Begin with a small request</h2>
    <p>Follow <a class="in" href="#keys">Get connected</a> to choose a path, then inspect the result
      and its usage. Keep the first request small enough that a failure is easy to understand.
      Expand the task after the connection and controls are working.</p>
    <ul>
      <li>Rate limits are counted against the <b>wallet</b>, not the key — a second key does not buy
        a second allowance.</li>
      <li>A sustained overrun returns <code>429</code> with a <code>retry-after</code> you should
        actually honour.</li>
      <li>A model listed as queued rather than live returns <code>404 model_not_in_pool</code>.
        Nothing is silently substituted.</li>
    </ul>
    <p><a class="btn line" href="models.html">Open the platform {AR}</a></p>

    <h2 id="cli">Work in your terminal</h2>
    <p>The CLI reads the same client key from <code>HANAMI_API_KEY</code> and streams to stdout,
      so it composes with the tools you already have.</p>
    <div class="code">
      <div class="bar"><span>terminal</span></div>
<pre><span class="c"># the register, as JSON</span>
mw models <span class="k">--json</span> | jq <span class="s">'.[] | select(.status=="live") | .id'</span>

<span class="c"># one prompt, two models, side by side</span>
mw compare <span class="k">-a</span> claude-opus-5 <span class="k">-b</span> gemini-3-pro <span class="s">"explain a bonding curve"</span></pre>
    </div>

    <h2 id="notes">Why this exists</h2>
    <p>Model choice is an operational decision, not a matter of taste, and it is made badly when the
      only way to compare two answers is to keep two tabs open. The comparison stays free because
      the choice has to be cheap to make. The pool exists so that the same choice survives into
      production without a second account, a second invoice and a second key per lab.</p>

    <div class="docnav">
      <div><span>&larr; Back to</span><b>Hanami platform overview</b></div>
      <div class="far"><span>Next &rarr;</span><b>Get connected</b></div>
    </div>
  </main>
</div>
</div>
<script src="data.js"></script>
<script src="app.js"></script>
</body>
</html>
"""

# -------------------------------------------------------------- staking
staking = head("Hanami · Staking access",
               "Choose a refundable allocation. Keep it active for 30 days to qualify for early "
               "enrollment in designated releases.") + top("staking") + f"""
<section class="band light"><div class="wrap">
  <h1 style="font-size:clamp(40px,5.4vw,66px)">Staking access</h1>
  <p class="lede" style="margin-top:20px">Choose a refundable allocation. Keep it active for 30 days
    to qualify for early enrollment in designated releases.</p>

  <div class="callout" style="margin-top:44px" id="mip">
    <div class="split tight">
      <div>
        <h3 style="font-size:24px">Help shape $HANA product access</h3>
        <p class="lede" style="margin-top:12px">MIP-007 proposes holding and staking tiers with
          larger inference allowances and more product capacity. Existing staking terms apply until
          changes are implemented.</p>
      </div>
      <div class="rows" style="align-self:center">
        <a href="#mip"><span class="t" style="font-size:17px;font-family:var(--sans);font-weight:600">Read the product tokenomics proposal</span></a>
        <a href="#mip"><span class="t" style="font-size:17px;font-family:var(--sans);font-weight:600">How staking works today and what&#39;s proposed</span></a>
      </div>
    </div>
  </div>

  <div class="split" style="margin-top:56px;grid-template-columns:1.5fr 1fr">
    <div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
        <button class="btn line" type="button">Connect wallet</button>
        <span style="margin-left:auto"></span>
        <button class="btn line" type="button">Refresh</button>
      </div>
      <hr style="border:0;border-top:1px solid var(--line);margin:32px 0">
      <h2 style="font-size:34px">Private Strategy</h2>
      <div style="margin-top:22px">
        <div class="kv"><span>Stake required</span><b>100,000 HANA</b></div>
        <div class="kv"><span>Staking slots remaining</span><b>12 of 20</b></div>
        <div class="kv"><span>Enrollment</span><b>Public enrollment</b></div>
      </div>
      <p class="lede" style="margin-top:24px;max-width:62ch">This pool has 20 slots shared across all
        wallets. Each wallet can hold one position in this pool. Slots awaiting withdrawal remain
        occupied until the tokens are withdrawn.</p>
      <p style="margin-top:26px"><button class="btn line" type="button" disabled
        style="opacity:.55;cursor:not-allowed">Approve and stake 100,000 HANA</button></p>
      <p class="sub" style="margin-top:22px;font-family:var(--mono);font-size:12.5px" id="ledger">
        Balances at finalized block 66,390,984.<br>
        Contract: 0x019660b1e6fe3e8c6f524b2facc28d37c0ca1275</p>
    </div>
    <div class="callout">
      <h3 style="font-size:26px">Your terms</h3>
      <ul class="terms">
        <li>Stakes are refundable. No yield, emissions or slashing.</li>
        <li>Each allocation requires its own fixed stake.</li>
        <li>Request withdrawal anytime. The wait is 24 hours.</li>
        <li>30 active days qualify a position for loyalty. Requesting withdrawal ends its streak.</li>
        <li>Designated releases offer 24-hour early enrollment for up to 25% of slots.</li>
      </ul>
      <p class="sub" style="margin-top:20px">Free inference stays available. Capacity and product
        availability apply to each allocation.</p>
    </div>
  </div>
</div></section>
""" + FOOT

here = pathlib.Path(__file__).parent
for name, doc in (("index.html", index), ("models.html", models),
                  ("docs.html", docs), ("staking.html", staking)):
    (here / name).write_text(doc, encoding="utf-8")
    print(name, len(doc), "bytes")
