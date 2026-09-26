# Ballast — site

Landing page for **Ballast**, a launchpad where every coin carries a basket of tokenized stocks:
1% of every trade buys the basket and sends it to holders every 15 minutes. Coins launch in one
transaction, from the app or from an agent, and the fee can never change.

The product comes out of the research in `reports/` and `research_notes/`: launchpad tokens whose
fee flows back into the token reached the largest market caps in September 2026, and coins paired
with tokenized stocks were the newest meta across Robinhood Chain, BNB Chain and Solana.

No build step, no dependencies. Plain HTML, CSS and vanilla JS, like the rest of the repository.

## Structure

```
index.html   the whole page: hero with a simulated trade feed, the fee mechanism, the basket
             builder, agents, an example coin page, rules, chains, FAQ and footer
styles.css   the design system (palette, type, layout) and the responsive rules
app.js       the simulated feed, the builder and its fee math, agent tabs, the revoke demo
             and copy buttons
```

## Run it

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

## What is real and what is a demo

- The hero feed is simulated and says so on screen.
- The builder's numbers are daily volume × 1% × the split (60% basket, 20% creator,
  10% BLST buyback and burn, 10% protocol). They illustrate the mechanism; they are not a forecast.
- The holders table is example data and is labelled that way.
- There is no token and no contract address yet. The page says so, and says where the address
  will be published.

## Design

White type on near-black with one blue (`#4C7DFF`) reserved for the parts that move money: fee
arrows, the basket, the share that goes back to holders. Big Shoulders Display for headlines,
Instrument Sans for text, JetBrains Mono for numbers and code.
