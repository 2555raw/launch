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
   - `SEEKR_LAUNCH` = the launch line on /token, e.g. `Fri 2 Oct on Pons` (can be set before launch too)
   - `ROBINHOOD_RPC_URL` is not needed: holdings are read through the public RPC (https://rpc.mainnet.chain.robinhood.com) by default
   - optional `SEEKR_DEXSCREENER_PAIR` = `<chainId>/<pairAddress>` to pin one pair instead of the most liquid
3. Wait for the redeploy, then check on seekr.website:
   - the "$SEEKR" pill in the nav shows a price and a 24h change on every page
   - `/api/markets` returns `"seekr":{"live":true,...}` with a price
   - on the home page, under the $SEEKR section, the contract address shows with a Copy button
   - on `/token`: the contract address shows with Copy and Blockscout links, Price, 24H, Market cap, Liquidity and 24H volume show numbers, and "Buy on Pons" and "Chart" open the right pages
4. Link a wallet that holds SEEKR in an account and check the allowance shows its percentage.
5. Render the announcement image with the contract address ("LIVE ON ROBINHOOD CHAIN", $SEEKR, "Hold it. Pay 5% on every AI model.", the CA) and hand it to the owner with the launch tweet.
6. If anything is wrong, remove the variables to go back to "soon".
