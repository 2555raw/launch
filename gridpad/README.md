# Gridpad

A launchpad where every coin is bound to a named renewable power station that
exists in the world — a dam, a wind farm, a solar field, a geothermal plant —
with its capacity, its coordinates and the body that published them written
into the token contract itself.

Launches go through **Pons V2** on **Robinhood Chain**. There is no launcher of
our own: Pons already mints a supply into a bonding curve that graduates into a
Uniswap V4 pool with locked liquidity, and a second contract doing the same
thing worse is not worth asking anyone to trust.

## The register

140 stations, 43 countries, four classes — hydro, wind, solar, geothermal.

Built from the **Global Power Plant Database v1.3.0** (World Resources
Institute), released under **CC BY 4.0**: commercial use allowed, attribution
required. The attribution is on the site and in `data.js`.

The database holds 23,354 renewable rows with coordinates and most are called
things like "PV Plant 118". A register nobody can read through is a search box,
not a register, so `scripts/build-register.py` curates rather than dumps, and it
ranks by **how checkable a row is** rather than how big it is: a named authority
as the source, a URL on the row, generation actually reported rather than
modelled. Per-country caps follow, because scoring on verifiability alone comes
back 80% American — the US Energy Information Administration reports generation
for everything it has.

Rebuild it with:

    npm run register -- path/to/global_power_plant_database.csv

## What ends up on chain

    Paired to Grand Coulee, United States of America (GC). Hydro, 6,809 MW,
    at 47.9575° N, 118.9773° W. The pairing names that power station and
    nothing more: it conveys no ownership of the plant, no claim on its
    output or its revenue, and no physical backing. [gridpad:1:GC]

The tag on the end is for an indexer; the rest is for a person. Both live in
the token's own `description`, which is set at launch and cannot be edited
afterwards by anyone, including whoever launched it.

## Tests

    npm test                  # the published Pons surface, selectors pinned
    npm run node              # a local EVM, in another shell
    npm run pair              # launch against a real factory and read it back

`npm run pair` is the one that matters: it runs `pons.js` — the same file the
browser loads — against `contracts/PonsV2Mock.sol` deployed on a local node,
launches a coin paired to a station from the register, and reads the
description back off the chain the way an explorer would.
