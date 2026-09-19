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
| lobby | 3m 45s | connect a wallet, press join, watch marbles drop into the hopper |
| locked | 5s | the field is closed and the seed is published |
| racing | up to 45s | the race, the same one in every browser |
| result | the rest | the winner, and the wallet to pay |

Set `ROUND_MS` to change the cycle (minimum 90 seconds - useful for testing,
not for a live coin).

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
| `ETH_RPC` | JSON-RPC endpoint (default `https://cloudflare-eth.com`, which is rate limited - use your own for anything busy) |
| `ETH_USD_FEED` | Chainlink ETH/USD aggregator (default is mainnet's; set it for Base or another chain) |
| `ETH_USD` | a fixed ETH price in dollars, if you would rather not read a feed |
| `CHAIN_NAME`, `EXPLORER` | what the page calls the chain and where transaction links go (default Ethereum, etherscan.io) |
| `ADMIN_KEY` | **set this**, or /admin is off |
| `SESSION_SECRET` | keeps sign-ins valid across restarts; random each boot if unset |
| `DATA_DIR` | where results are written (default `./data`) |
| `ROUND_MS` | round length in ms (default 300000) |
| `MAX_PLAYERS` | marbles per race (default 250); anyone turned away is put in the next race automatically |
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
server.js            http, the event stream, the api, the admin routes
lib/round.js         the five minute clock, the commit-reveal, the field
lib/store.js         results on disk
lib/chain.js         signature checks, balances, the ETH/USD price, token holdings
public/shared/race.js  the physics - the one file the server and the browser share
public/render.js     the canvas
public/app.js        the page: stream, wallet, chat, cheers
public/verify.html   replay any past race and check the winner
public/admin.html    the payout desk
```

`public/shared/race.js` runs on both sides, which is the whole trick: the server
plays the race out in a few milliseconds and keeps the result, and every browser
replays the same race in real time. That only holds because the engine avoids
anything a JavaScript engine is free to round differently - no `Math.random`, no
`Math.sin`, a fixed timestep. The rules are written at the top of that file; if
you change it, read them first. The result people are paid on always comes from
the server, so a browser that disagreed would only be showing the wrong picture,
not paying the wrong wallet.

## The preview page

`preview/` builds a single self-contained HTML file: the real engine and the
real renderer, inlined byte for byte, around a page that races on its own with
demonstration marbles. It is for showing people what the game looks like when
there is nowhere to run the server yet - it has no wallets to verify, no shared
field, no seed commitment and no fees.

```
node preview/build.js      # -> preview/dist/marble-royale-preview.html
```

Open the file anywhere, or publish it. Anything it shows on the track is what
the real site shows, because it is the same code.
