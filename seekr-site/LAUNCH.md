# $SEEKR launch day

Switching the site from "soon" to the live coin is configuration only; no code changes.

## What the owner provides

1. The $SEEKR contract address on Robinhood Chain (copied from the launch page or the block explorer).
2. The buy link: the page where people buy it.
3. Optional: a chart link. Without one, the DexScreener page for the most liquid pair is used.

## Steps

1. Check the address before using it: it must return a $SEEKR pair on
   `https://api.dexscreener.com/latest/dex/tokens/<address>` (symbol SEEKR, chain Robinhood).
   If DexScreener has not indexed it yet, wait and retry. Never use an address that shows a different symbol.
2. Set these variables on the Railway service `seekr` (production):
   - `SEEKR_TOKEN_ADDRESS` = the contract address
   - `SEEKR_BUY_URL` = the buy link
   - `SEEKR_CHART_URL` = the chart link, or `https://dexscreener.com/<chainId>/<pairAddress>` from step 1
   - optional `SEEKR_DEXSCREENER_PAIR` = `<chainId>/<pairAddress>` to pin one pair instead of the most liquid
3. Wait for the redeploy, then check on seekr.website:
   - the "$SEEKR" pill in the nav shows a price and a 24h change on every page
   - `/api/markets` returns `"seekr":{"live":true,...}` with a price
   - on `/token`, Price and 24H show numbers, and "Buy $SEEKR" and "Chart" open the right pages
4. If anything is wrong, remove the variables to go back to "soon".
