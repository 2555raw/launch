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
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Figtree:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
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
    "Blossom": [
        ("Meet Blossom", "docs.html#blossom", "Talk an idea into an agent brief"),
        ("Agent briefs", "docs.html#blossom", "Mission, research skills, a character"),
        ("CLI documentation", "docs.html#cli", "The same key, in your terminal"),
    ],
    "Community": [
        ("Commons", "staking.html", "Where the pool is discussed"),
        ("Roadmap", "staking.html#mip", "Proposals, and what is being built"),
        ("Ledger", "staking.html#ledger", "Published usage and pool reporting"),
    ],
}

def menu(label):
    items = "".join(
        f'<a href="{h}" role="menuitem"><b>{t}</b><span>{d}</span></a>'
        for t, h, d in MENUS[label])
    mid = label.lower()
    return (f'<div class="menu">'
            f'<button type="button" aria-expanded="false" aria-controls="m-{mid}" '
            f'aria-haspopup="true">{label}{CV}</button>'
            f'<div class="pop" id="m-{mid}" role="menu" hidden>{items}</div>'
            f'</div>')

def top(active=""):
    flat = [("Platform", None), ("Blossom", None), ("Community", None),
            ("Rewards", "staking.html"), ("Docs", "docs.html")]
    desk = "".join(menu(t) if h is None else f'<a href="{h}">{t}</a>' for t, h in flat)
    # The same links, flattened, for the drawer — a phone has no hover and no
    # room for a second level.
    drawer = ""
    for t, h in flat:
        if h is None:
            drawer += f'<h6>{t}</h6>' + "".join(
                f'<a href="{u}">{n}</a>' for n, u, _ in MENUS[t])
        else:
            drawer += f'<a class="solo" href="{h}">{t}</a>'
    return f"""<header class="top"><div class="wrap">
  <a class="brand" href="index.html">{MARK} Manyways</a>
  <nav class="tnav" aria-label="Main">{desk}</nav>
  <div class="far">
    <button class="who" type="button" aria-label="Your account">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="8" r="3.4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>
    </button>
    <a class="btn pale" href="staking.html">Get started</a>
    <button class="who burger" type="button" id="burger" aria-expanded="false"
            aria-controls="drawer" aria-label="Menu">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
    </button>
  </div>
</div>
<div class="drawer" id="drawer" hidden><div class="wrap">{drawer}</div></div>
</header>
"""

FOOT = f"""<footer class="foot"><div class="wrap">
  <div class="foot-grid">
    <div>
      <div class="brand">{MARK} Manyways</div>
    </div>
    <div><h4>Platform</h4><ul>
      <li><a href="models.html">Console</a></li>
      <li><a href="index.html#compare">Playground</a></li>
      <li><a href="index.html#compare">Render</a></li>
      <li><a href="models.html">Models</a></li>
    </ul></div>
    <div><h4>Build</h4><ul>
      <li><a href="docs.html">Blossom</a></li>
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
    <div><dt>Base URL</dt><dd>api.manyways.dev/v1</dd></div>
    <div><dt>Auth</dt><dd>Bearer · wallet-scoped</dd></div>
    <div><dt>Streaming</dt><dd>SSE · text/event-stream</dd></div>
    <div><dt>Chain</dt><dd>Robinhood Chain · 4663</dd></div>
    <div><dt>Settlement</dt><dd>WETH</dd></div>
    <div><dt>Token</dt><dd>$MANY</dd></div>
    <div><dt>Limits</dt><dd>per wallet · burst-tolerant</dd></div>
  </dl>

  <div class="rule">
    <span>&copy; <span data-year>2026</span> Manyways</span>
    <span class="mid">Every model. Your way.</span>
    <a href="#" id="totop">Back to top &nbsp;&uarr;</a>
  </div>
</div></footer>
<script src="data.js"></script>
<script src="app.js"></script>
</body>
</html>
"""

# ---------------------------------------------------------------- index
index = head("Manyways · Every model. Your way.",
             "Explore every model, compare answers side by side, and build with the ones you "
             "choose — one wallet-scoped key, one endpoint.",
             '') + top("index") + f"""
<section class="hero">
  <div class="frame">
    <img id="heroimg" src="media/hero.jpg" alt="Cherry trees in blossom below Mount Fuji at dusk">
    <canvas id="grove" hidden aria-label="An engraving of a cherry grove over a river"></canvas>
    <div class="over"><div class="wrap">
      <h1>Every model.<br>Your way.</h1>
      <p>A place to explore AI, bring ideas to life, and build with the models you choose.</p>
      <div class="cta">
        <a class="btn pale" href="#curiosity">Ask Blossom {AR}</a>
        <a class="btn on-dark" href="docs.html">Learn more {AR}</a>
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
      <p>Talk it through with Blossom. Build an agent brief with a mission, research skills,
        and a character of its own.</p>
      <a class="btn pale" href="docs.html#blossom">Meet Blossom {AR}</a>
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
      <a class="link" style="margin-top:22px" href="models.html">Open the register {AR}</a>
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
      <p class="sub" id="compare-out" hidden style="margin-top:14px"></p>
    </div>
  </div>
</div></section>

<section class="band dark"><div class="wrap">
  <div class="split">
    <div class="stack">
      <h2>Shared access.<br>More ways forward.</h2>
      <p>Manyways makes AI easier to explore and use. Start with a free web comparison, then
        connect a wallet to create client keys for the shared inference pool.</p>
      <p>Access follows wallet-scoped fair-use limits. Explore the register, see how the pool is
        used, and help shape what gets built next.</p>
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
models = head("Manyways · The model register",
              "Every model reachable through the shared pool, with its context window and what a "
              "million tokens costs in each direction.") + top("models") + f"""
<section class="band light" style="padding-bottom:0"><div class="wrap">
  <p class="crumb"><a href="index.html">Manyways</a> / Platform / Models</p>
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
curl https://api.manyways.dev/v1/chat/completions \\
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
    <button type="button" aria-pressed="true">Manyways</button>
    <button type="button" aria-pressed="false">Blossom</button>
  </div>
  <nav>{a("Manyways platform overview", "#")}</nav>
  <h5>Start here</h5>
  <nav>
    {a("What is the Manyways platform?", "#", True)}
    {a("Get connected", "#keys")}
    {a("Why we&#39;re building Manyways", "#notes")}
  </nav>
  <h5>Work in your terminal</h5>
  <nav>
    {a("Manyways CLI", "#cli")}
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

RAIL_ICONS = [
    ('index.html', '<path d="M4 7h16M4 12h16M4 17h10"/>', "Home"),
    ('models.html', '<path d="M5 12l7-7 7 7-7 7z"/>', "Models"),
    ('staking.html', '<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/>', "Rewards"),
    ('index.html#curiosity', '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>', "Playground"),
]
rail = '<nav class="rail" aria-label="Sections">' + \
    f'<a href="index.html" aria-label="Manyways" style="color:var(--on-dark)">{MARK}</a>' + \
    "".join(f'<a href="{h}" aria-label="{t}"><svg width="19" height="19" viewBox="0 0 24 24" '
            f'fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">{p}</svg></a>'
            for h, p, t in RAIL_ICONS) + \
    '<span class="gap"></span>' + \
    '<a href="docs.html" class="on" aria-label="Docs"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/></svg></a>' + \
    '<a href="staking.html" aria-label="Your account"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5 20a7 7 0 0 1 14 0"/></svg></a>' + \
    '</nav>'

TAB = [
  ("Client key", "tp1", "A credential for one client.",
   "Your wallet identifies the member. A revocable client key authenticates the application and "
   "carries its saved defaults.",
   "Client key", "Authorization: Bearer $MANYWAYS_API_KEY"),
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

docs = head("Manyways · Documentation",
            "The Manyways API, CLI and controls in one developer workflow.") + f"""
<div class="docs">
{rail}
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
    <p class="crumb"><a href="docs.html">Docs</a> / <a href="docs.html">Manyways platform</a> / Start here</p>
    <h1>What is the Manyways platform?</h1>
    <p class="tagline">The Manyways API, CLI and controls in one developer workflow.</p>
    <p><button class="link" type="button" style="background:none;border:0;cursor:pointer;padding:0"
       data-copy="#md" data-label="Copy as Markdown">Copy as Markdown</button></p>
    <span id="md" hidden># What is the Manyways platform?

Manyways is the model routing platform. Explore models, compare responses, or connect directly
from your own tools. Client keys connect the work to your wallet; quivers and routing give you
control over how requests are allowed and routed.</span>
    <hr>
    <p>Manyways is the model routing platform. Explore models, compare responses, or connect
      directly from your own tools. Use the <a class="in" href="#cli">CLI</a> in your local
      workspace or send requests from your application. <a class="in" href="#keys">Client keys</a>
      connect the work to your wallet; limits and routing give you control over how requests are
      allowed and routed.</p>

    <h2 id="first">Choose your interface</h2>
    <p>The <a class="in" href="#cli">Manyways CLI</a> provides a terminal client with streamed
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
    <p>The CLI reads the same client key from <code>MANYWAYS_API_KEY</code> and streams to stdout,
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
      <div><span>&larr; Back to</span><b>Manyways platform overview</b></div>
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
staking = head("Manyways · Staking access",
               "Choose a refundable allocation. Keep it active for 30 days to qualify for early "
               "enrollment in designated releases.") + top("staking") + f"""
<section class="band light"><div class="wrap">
  <h1 style="font-size:clamp(40px,5.4vw,66px)">Staking access</h1>
  <p class="lede" style="margin-top:20px">Choose a refundable allocation. Keep it active for 30 days
    to qualify for early enrollment in designated releases.</p>

  <div class="callout" style="margin-top:44px" id="mip">
    <div class="split tight">
      <div>
        <h3 style="font-size:24px">Help shape $MANY product access</h3>
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
        <div class="kv"><span>Stake required</span><b>100,000 MANY</b></div>
        <div class="kv"><span>Staking slots remaining</span><b>12 of 20</b></div>
        <div class="kv"><span>Enrollment</span><b>Public enrollment</b></div>
      </div>
      <p class="lede" style="margin-top:24px;max-width:62ch">This pool has 20 slots shared across all
        wallets. Each wallet can hold one position in this pool. Slots awaiting withdrawal remain
        occupied until the tokens are withdrawn.</p>
      <p style="margin-top:26px"><button class="btn line" type="button" disabled
        style="opacity:.55;cursor:not-allowed">Approve and stake 100,000 MANY</button></p>
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
