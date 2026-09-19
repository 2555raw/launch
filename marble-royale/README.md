# MARBLE ROYALE

A marble race every five minutes, on the clock. Anyone with an Ethereum wallet
connects, joins the queue, and one marble on the track is theirs. The first
marble across the line wins, and the winner's wallet address is put on screen so
a share of the creator fees collected during those five minutes can be sent to
it. The pot is shown in dollars.

The site is one Node process with one dependency (ethers, for signatures and
the RPC), no build step and no database. It never holds a private key and never
moves money.

```
npm start            # http://localhost:8080
```

## How a round works

Rounds are pinned to the wall clock, so a race starts at :00, :05, :10 and
everyone sees the same countdown wherever they are.

| phase | length | what happens |
|---|---|---|
| lobby | 3m 25s | connect a wallet, press join, watch marbles drop into the hopper |
| locked | 5s | the field is closed and the seed is published |
| racing | up to 65s | the race, the same one in every browser; the winner is usually home in 20 to 40 |
| result | the rest | the winner, the wallet to pay, and a vote on the next track |

Set `ROUND_MS` to change the cycle (minimum 90 seconds - useful for testing,
not for a live coin).

The grid opens at thirty places. Once twenty-four are taken it grows to fifty
for that race, so a busy night is not a queue and a quiet one still looks like
a race. Anyone turned away from a full grid is put in the next race.

## Game modes

Every race draws a fresh course from its seed inside one of eight modes. A mode
is which sections the course may use, how many, and a nudge to gravity and
bounce; two races in the same mode are never the same track.

| mode | what it is |
|---|---|
| Classic | everything: pegs, ramps, spinners, jumps, boost pads, 11 to 13 sections |
| Plinko Hell | walls of pins and bumpers, nothing else; extra bounce |
| Boost Alley | boost rails and kickers all the way down; heavier |
| Spin Cycle | spinning arms, flippers and sliding pistons |
| Funnel Run | throats, wedges and steps; the pack squeezes through gaps |
| Mega Drop | few sections, 1.35× gravity, big jumps; over in a flash |
| Ice Rink | 1.3× bounce; bumpers throw marbles across the track |
| The Maze | switchbacks and steps with no straight fall; the longest course |

When a race ends, the results screen puts two modes to a vote (never the one
just raced). One vote per wallet; the poll closes two seconds before the next
lobby opens and the winner is the next track. A tie is a coin toss. The lobby
shows the track with a picture drawn from the course generator, and the home
page explains all eight. The mode is public before the seed exists, so it
changes nothing about the fairness scheme below.

## Marbles

Every wallet gets a marble in its own colour, derived from the address so it is
the same every race. Anyone can pick a colour and a face instead (MY MARBLE,
next to the join button); the choice is kept in that browser and sent along
with each join, checked on the server, and shown to everyone.

## Fair, and checkable by anyone

The seed decides the course, the starting slots and every bounce, so whoever
picks the seed picks the winner. This is how the seed is kept honest:

1. When a round opens, before a single wallet has joined, the server draws a
   secret at random and publishes only `sha256(secret)`. It is on screen in the
   footer.
2. When the field closes, the seed is `sha256(secret + "|" + the joined wallets)`
   and the secret itself is published.
3. Anyone can then check that the hash shown at the start really is the hash of
   that secret, and that the seed really follows from it and from that field.

So the server cannot wait to see who joined and then choose a seed that suits
it, and it cannot quietly change the field either. **/verify** does all of this
in the visitor's own browser and replays the race with the same engine the
server used, then says whether the announced winner is the one the seed
produces.

The starting slots are shuffled with the seed too, so joining early does not buy
a better position.

## Paying the winner

The server reads balances and nothing else - no key ever reaches it. Paying is a
person's job:

- **/admin** (with `ADMIN_KEY`) lists every round that had a winner, newest
  first, with the wallet to pay, the amount, and a button to mark it paid once
  the transaction is sent. There is a CSV of the lot.
- The winner's address is also on the front page after each race, and in the
  WINNERS panel, where anyone can copy it and check you paid.

**The pot.** Set `FEE_WALLET` to the wallet your creator fees land in. The
server reads its ETH balance when a round opens and again when it closes, and
the difference is what that round earned. It is priced in dollars from the
Chainlink ETH/USD feed over the same RPC; the winner's pot is `POT_PCT` of that
(20% unless you say otherwise), and the ETH figure, the dollar figure and the
share are all kept with the round. Move money out of that wallet mid-round
and the figure for that round will read low - use a wallet that only collects,
and sweep it between rounds if you must. With no `FEE_WALLET` set, the pot shows
as `—` and you type the amount for each round on the admin page.

## Settings

All optional except where noted.

| variable | what it does |
|---|---|
| `PORT` | port to listen on (default 8080) |
| `COIN_NAME`, `COIN_TICKER` | what the header says |
| `TOKEN_MINT` | your coin's contract address (shown as the CA, and used by the holder gate) |
| `MIN_TOKENS` | hold at least this many to race. `0` (default) lets anyone in |
| `FEE_WALLET` | the wallet creator fees arrive in, for the pot figure |
| `POT_PCT` | the share of those fees the winner takes, as a percentage (default 20). It is shown on screen and stored with every round |
| `MEGA_EVERY_MS` | how often a round is a mega race (default 1800000, the hour and the half hour) |
| `MEGA_PCT` | the winner's share on a mega race (default 50) |
| `ETH_RPC` | JSON-RPC endpoint of the chain the coin lives on. The default is Ethereum mainnet's public one; for Robinhood Chain set its RPC URL here |
| `CHAIN_NAME` | what the page calls the chain (default Robinhood Chain) |
| `ETH_USD_FEED` | Chainlink ETH/USD aggregator on that chain (default is mainnet's). If the chain has no feed yet, set `ETH_USD` instead |
| `ETH_USD` | a fixed ETH price in dollars, if you would rather not read a feed |
| `EXPLORER` | where transaction links go (default etherscan.io; set the chain's own explorer) |
| `ADMIN_KEY` | **set this**, or /admin is off |
| `DEMO_MODE` | `1` hands out demo wallets and, with no fee wallet, acts the pot. Off by default |
| `ENTRY_LABEL` | what the lobby shows for entry (default FREE) |
| `SESSION_SECRET` | keeps sign-ins valid across restarts; random each boot if unset |
| `DATA_DIR` | where results are written (default `./data`) |
| `ROUND_MS` | round length in ms (default 300000) |
| `MAX_PLAYERS` | places on the grid when a race opens (default 30) |
| `MAX_PLAYERS_HIGH` | what the grid grows to once it is 80% full (default 50); anyone turned away is put in the next race |
| `LINK_BUY`, `LINK_X`, `LINK_TG` | buttons in the footer |
| `PAYOUT_NOTE` | a line under the winner's address, e.g. "paid within the hour" |

## Deploying

Railway, the way the other projects in this repository are deployed: point a
service at this folder, it runs `npm start` and listens on `$PORT`. Add a volume
mounted somewhere like `/data` and set `DATA_DIR=/data` so results survive a
redeploy, and set `SESSION_SECRET` so nobody has to sign in again after one.

Anywhere that runs Node 18+ works the same after `npm install`. There is nothing to build.

## What stops someone gaming it

- **Entering someone else's wallet.** You cannot. Joining requires a signed
  message (EIP-191 `personal_sign`) from the wallet, and the server recovers the
  signer and compares it with the address, so the marble that wins belongs to
  whoever can sign for it.
- **Entering twice.** One marble per address per race.
- **Betting on the winner.** The seed does not exist until the field is closed,
  and the field is closed before anyone can act on it.
- **Cheering your way to a win.** Cheers are confetti. They cannot touch the
  physics - if they could, every browser's replay would drift away from the
  result.
- **A hundred wallets, one person.** This is the honest limit: a marble is free,
  so nothing here stops someone entering ten wallets except `MIN_TOKENS`. If the
  pot is worth farming, set it to a real number of coins.

## Layout

```
server.js                 http, the event stream, the api, the admin routes
lib/round.js              the five minute clock, the commit-reveal, the field, the schedule
lib/store.js              results on disk, race numbers
lib/chain.js              signature checks, balances, the ETH/USD price, token holdings

public/shared/race.js     the physics - the one file the server and the browser share
public/render.js          2D drawing: coin faces, the verify page, the pickers
public/js/types.js        the shapes that cross module boundaries (JSDoc)
public/js/store.js        four stores: game, ui, wallet, chain
public/js/game/scene.js   the 3D world: track, marbles, particles, bloom (three.js)
public/js/game/camera.js  the camera director: idle, overview, gate, follow, battle, finish, victory
public/js/game/skins.js   marble materials: glass, metal, holo, neon, chrome, clear, lava, galaxy
public/js/game/audio.js   the sound manager, synth cues until files are dropped in
public/js/web3/wallet.js  MetaMask, Phantom (EVM), EIP-6963 wallets, demo wallets
public/js/web3/contracts.js  joinRace / getRace / … with a demo backend and an on-chain stub
public/js/app.js          the screens: home, lobby, countdown, race HUD, results
public/js/standalone.js   the game with no server, for the one-file preview
public/vendor/three/      three.js and the post-processing passes it needs
public/verify.html        replay any past race and check the winner
public/admin.html         the payout desk
preview/build-app.js      builds preview/dist/marble-royale.html, the one-file game
```

`public/shared/race.js` runs on both sides, which is the whole trick: the server
plays the race out in a few milliseconds and keeps the result, and every browser
replays the same race in real time - in 3D, but the 3D only ever reads the
engine. That only holds because the engine avoids anything a JavaScript engine
is free to round differently - no `Math.random`, no `Math.sin`, a fixed
timestep. The rules are written at the top of that file; if you change it, read
them first. The result people are paid on always comes from the server, so a
browser that disagreed would only be showing the wrong picture, not paying the
wrong wallet.

## The game

The world is one WebGL canvas and every screen is glass over it. The flow is
home → connect → lobby → join → countdown → race → results → race again, and the
page moves itself along: the countdown pulls you onto the track, the result
brings up the podium.

- **Wallets.** MetaMask, Phantom's Ethereum side and anything announcing itself
  through EIP-6963. Signing in is a `personal_sign`, never a transaction. With
  `DEMO_MODE=1` the server also hands out demo wallets - a random address and a
  session, nothing on any chain - so the game can be tried with nothing
  installed. Everything a demo wallet does is labelled demo.
- **Marbles.** Eight materials, fifteen coin faces, ten colours and a name up to
  sixteen characters, chosen in the lobby and sent with the join. The server
  checks every field and everyone sees what you picked.
- **The pot.** Read off the fee wallet and priced in dollars, as before. With
  no fee wallet and demo mode on, it is acted: it climbs a cent at a time to a
  few dollars over the queue, twenty-five on a mega race, and every figure is
  marked demo.
- **The contract.** `CONTRACTS.race` exposes joinRace, getRace,
  getRaceParticipants, getRaceState, getRaceResults and claimPrize. The demo
  backend is the server; the on-chain backend is named, typed and throws until a
  contract address is configured. A join is a small transaction state machine
  the lobby shows honestly: waiting for wallet → confirm → pending →
  confirmed or failed, with "demo, nothing on-chain" appended when that is
  what it is.
- **Physics.** Marbles roll rather than skate: restitution fades out below a
  closing speed so a marble settles onto a ramp, a rolling ball takes five
  sevenths of the pull a sliding one would, drag grows with speed, and marble
  on marble is a glass clack with a little friction. All of it is still plain
  arithmetic, so the replay in every browser matches the server's result.
- **The dock.** A taskbar along the bottom: Home, Race (with the phase and
  clock), Modes, Launch, Winners, Wallet, and the pot. It steps aside for the
  countdown and the race.
- **The launchpad.** A screen for launching a token with races of its own:
  name, ticker, marble, colour, race cadence, winner's share and a holder
  minimum, with a live preview card. Launches are saved in the browser as
  drafts. `CONTRACTS.launchpad.createToken` is the deploy call; until a
  launchpad contract address is configured with `CONTRACTS.useLaunchpad`, it
  fails with the truth rather than a fake receipt.
- **Sound.** Off by default and there is no music. The note in the top bar
  turns the cues on; `SOUND.play('go')` and friends are synthesised until a
  file is loaded with `SOUND.load(name, url)`.
- **The one-file preview.** `node preview/build-app.js` inlines the whole game
  into `preview/dist/marble-royale.html` with the server stood in for by
  `standalone.js`: a round every five minutes, bots in the field, a demo pot,
  three.js from a CDN. It says on the page that it is a preview build.
