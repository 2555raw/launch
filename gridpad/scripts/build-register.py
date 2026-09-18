"""Build the register from the Global Power Plant Database.

    python3 scripts/build-register.py path/to/global_power_plant_database.csv

The source is WRI's Global Power Plant Database, v1.3.0, released under
CC BY 4.0 — commercial use allowed, attribution required, which is why
`ATTRIBUTION` below ends up printed on the site and nothing here strips the
source or the URL off a row.

    https://github.com/wri/global-power-plant-database
    https://datasets.wri.org/dataset/globalpowerplantdatabase

The register is curated, not dumped. 23,354 renewable rows carry coordinates
and most of them are called things like "PV Plant 118": a register nobody can
read through is a search box, not a register. What survives here is an
installation with a name a person recognises, a capacity worth stating, and —
this is the part that decides the order — a source somebody can go and check.

Ranking is by how checkable a row is, not by how big it is:

  a named authority or operator as the source   40
  a URL on the row                              20
  generation actually reported, not estimated   25
  a commissioning year                           8
  a named owner                                  7

Then per-country caps, because the first pass came back 80% American: the US
Energy Information Administration reports generation for everything it has, so
scoring by verifiability alone quietly buys a register of American dams.
"""
import csv, json, re, sys, collections, os

ATTRIBUTION = ("Global Power Plant Database v1.3.0, World Resources Institute, "
               "CC BY 4.0 — https://datasets.wri.org/dataset/globalpowerplantdatabase")

CLASSES = ("Hydro", "Wind", "Solar", "Geothermal")
FLOOR = {"Hydro": 1000, "Wind": 300, "Solar": 250, "Geothermal": 100}   # MW
# Seven a class, twenty-eight in all: a register somebody can come to know,
# rather than one they have to search. The floors below are what earns a slot.
WANT = {"Hydro": 7, "Wind": 7, "Solar": 7, "Geothermal": 7}
# Seven slots a class: two from one country would be a third of it.
PER_COUNTRY_CLASS, PER_COUNTRY = 2, 3

# Twenty-eight slots is short enough that being recognised matters as much as
# being checkable. Ranking purely on verifiability filled the hydro class with
# "HPP Portile de Fier I" and left out Three Gorges and Itaipu, which are the
# two power stations a stranger can actually picture. These get a slot if they
# are in the data and clear the floor; everything else is earned by score.
# Hand-picked, and said out loud rather than dressed up as an algorithm.
MARQUEE = [
    "three gorges", "itaipu", "simon bolivar", "tucuru", "grand coulee", "longyangxia",
    "gansu wind", "hornsea", "london array", "walney", "whitelee", "horns rev",
    "noor ouarzazate", "kamuthi", "quaid-e-azam", "cestas",
    "geysers", "hellishei", "olkaria i", "cerro prieto", "wairakei",
]

AUTHORITY = re.compile(
    r"Energy Information Administration|Renewable Energy Planning Database|Open Power System Data"
    r"|Ag[eê]ncia Nacional|Natural Resources Canada|Red El[eé]ctrica|Endogenas|ENTSOE"
    r"|Central Electricity Authority|Ministry|Authority|Commission|Corporation|Board|Agency"
    r"|Department|Regulator|Comisi[oó]n|Secretar|Bureau", re.I)

def num(x):
    try: return float(x)
    except (TypeError, ValueError): return None

def reported(r):
    """The most recent year with generation actually reported. The estimated_*
    columns are modelled and deliberately not consulted: a figure somebody can
    look up is the whole point of this register."""
    for y in range(2019, 2012, -1):
        v = num(r.get(f"generation_gwh_{y}"))
        if v: return y, v
    return None, None

def is_named(n):
    n = (n or "").strip()
    if len(n) < 4: return False
    if not re.search(r"[A-Za-zÀ-ÿ]{3,}", n): return False
    # a name that is only a category and a number: "Solar Farm 4412"
    return not re.fullmatch(
        r"(?:(?:solar|wind|pv|hydro|power|plant|farm|park|station|project|energy|"
        r"generat\w*|unit|site)[\s\-_,.]*|\d+[\s\-_,.]*)+", n, re.I)

def tidy(n):
    """Names arrive as their source keyed them in: shouting, stray brackets,
    a trailing unit number that means nothing to a reader."""
    n = re.sub(r"[{}\[\]]", "", n).strip(" -,.")
    n = re.sub(r"\s{2,}", " ", n)
    if n.isupper() and len(n) > 4:
        n = " ".join(w if len(w) <= 3 and w.isupper() else w.capitalize() for w in n.split())
    n = re.sub(r"\s+(?:Unit|Units|No\.?|Phase)\s+[\dIVX\-–]+$", "", n, flags=re.I)
    return n.strip()

def score(r):
    s = 0
    if AUTHORITY.search(r.get("source") or ""): s += 40
    if (r.get("url") or "").startswith("http"): s += 20
    if reported(r)[1]: s += 25
    if num(r.get("commissioning_year")): s += 8
    if (r.get("owner") or "").strip(): s += 7
    return s

def ticker(name, taken):
    words = [w for w in re.findall(r"[A-Za-zÀ-ÿ]+", name.upper()) if w not in
             ("THE", "DE", "DEL", "LA", "EL", "AND", "OF", "DAM", "II", "III")]
    for cand in ([("".join(w[0] for w in words[:4]))] if len(words) > 1 else []) + \
                [w[:4] for w in words] + [(words[0][:3] + words[-1][:2]) if len(words) > 1 else ""]:
        cand = re.sub(r"[^A-Z]", "", cand)[:5]
        if 2 <= len(cand) <= 5 and cand not in taken:
            taken.add(cand); return cand
    base = re.sub(r"[^A-Z]", "", name.upper())[:3] or "GEN"
    for i in range(2, 99):
        cand = f"{base}{i}"
        if cand not in taken:
            taken.add(cand); return cand
    raise SystemExit("ran out of tickers")

def main(path):
    rows = list(csv.DictReader(open(path, encoding="utf-8", errors="replace")))
    cand = []
    for r in rows:
        f = r.get("primary_fuel")
        cap, la, lo = num(r["capacity_mw"]), num(r["latitude"]), num(r["longitude"])
        if f in CLASSES and cap and la is not None and lo is not None \
           and cap >= FLOOR[f] and is_named(r["name"]):
            cand.append(r)
    cand.sort(key=lambda r: (-score(r), -num(r["capacity_mw"])))

    out, per_cc, per_c = [], collections.Counter(), collections.Counter()
    have = collections.Counter()

    def take(r):
        f, c = r["primary_fuel"], r["country_long"]
        out.append(r); have[f] += 1; per_cc[(c, f)] += 1; per_c[c] += 1

    # The named ones first, biggest match wins where a name appears twice.
    for want in MARQUEE:
        hits = [r for r in cand if want in r["name"].lower()]
        if not hits: continue
        r = max(hits, key=lambda r: num(r["capacity_mw"]))
        if have[r["primary_fuel"]] < WANT[r["primary_fuel"]] and r not in out:
            take(r)

    # Then the rest on score, under the caps.
    for r in cand:
        f, c = r["primary_fuel"], r["country_long"]
        if r in out or have[f] >= WANT[f]: continue
        if per_cc[(c, f)] >= PER_COUNTRY_CLASS or per_c[c] >= PER_COUNTRY: continue
        take(r)

    taken, reg = set(), []
    for r in out:
        y, g = reported(r)
        name = tidy(r["name"])
        reg.append({
            "t": ticker(name, taken),
            "n": name,
            "c": r["primary_fuel"],
            "l": r["country_long"],
            "mw": round(num(r["capacity_mw"]), 1),
            "g": [round(num(r["latitude"]), 4), round(num(r["longitude"]), 4)],
            "y": int(num(r["commissioning_year"])) if num(r.get("commissioning_year")) else None,
            "o": (r.get("owner") or "").strip() or None,
            "src": (r.get("source") or "").strip(),
            "url": (r.get("url") or "").strip() or None,
            "gen": {"year": y, "gwh": round(g, 1)} if g else None,
            "id": r.get("gppd_idnr") or None,
        })
    reg.sort(key=lambda x: (x["c"], -x["mw"]))
    return reg

if __name__ == "__main__":
    if len(sys.argv) < 2: raise SystemExit(__doc__)
    reg = main(sys.argv[1])
    here = os.path.dirname(os.path.abspath(__file__))
    body = ("/* Generated by scripts/build-register.py. Do not edit by hand.\n"
            " *\n * Source: " + ATTRIBUTION + "\n */\n\n"
            "const ATTRIBUTION = " + json.dumps(ATTRIBUTION) + ";\n\n"
            "const PLANTS = " + json.dumps(reg, ensure_ascii=False, indent=1) + ";\n")
    open(os.path.join(here, "..", "data.js"), "w", encoding="utf-8").write(body)
    print(f"{len(reg)} plants, {len(set(p['l'] for p in reg))} countries")
    for k, v in collections.Counter(p["c"] for p in reg).items(): print(f"  {k:12s} {v}")
