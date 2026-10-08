# Launch a token with the rules built in

*Why we built UnyHooks, and how it works on Robinhood Chain.*

---

Every token launch asks people for the same thing: trust.

Trust that the liquidity won't be pulled an hour in. Trust that a bot won't buy half the supply in the first block. Trust that the contract doesn't have a hidden mint, a tax switch or a blocklist waiting for the right moment.

Most of the time that trust is just a promise in a Telegram pin. A promise can be broken. Code that runs on every trade can't.

That's the idea behind **UnyHooks**: put the rules of a launch inside the pool itself, where nobody can change them. Not the buyers, not the bots, not even the person who launched it.

## What a hook is

Uniswap V4 added something new: **hooks**. A hook is a small contract that the pool calls on every single swap. It sees the trade and the time. It can let the trade through, take a fee from it, or refuse it.

That makes the pool programmable. Rules that used to live in announcements can now live in code that runs on every swap, forever, in plain sight.

UnyHooks is a launchpad and a hook builder for Uniswap V4 on Robinhood Chain. It writes those hooks for you, deploys them from your own wallet, and launches tokens that use them.

## One signature, five things

When you launch a token on UnyHooks, you sign **one** transaction. In that one transaction:

1. **The token** is minted. Fixed supply, minted once.
2. **Its Uniswap V4 pool** opens against ETH.
3. **The launch hook** is attached to that pool.
4. **Your ETH and tokens** go in as liquidity.
5. **The liquidity goes into a lock** for the time you chose.

If any part fails, none of it exists. There is no half-launched state, no window where the pool is open but the protection isn't on yet, no moment where the liquidity sits unlocked in a wallet.

You don't need a big budget to start. You can pair your token with as little as 0.0001 ETH (the page suggests 0.01), plus gas. UnyHooks takes no cut of your launch: every bit of the ETH you add goes into your pool.

## The first hour: snipers get nothing

The first block of a new token is where bots feast. They see the pool open and buy a huge share of the supply before any human can click.

The launch hook stops that. For the launch window you set (an hour by default):

- **Every buy is capped.** No single buy can be larger than the limit you set.
- **Every wallet waits between buys.** One buy, then a cooldown (30 seconds by default).
- **Selling is never limited.** Nobody gets trapped. The hook only slows buying, and only during the window.

When the window ends, the limits lift on their own. The hook reads the time from the chain, so nobody can switch the window off early or stretch it out later.

A bot trying to buy 2 ETH in the first block doesn't get a smaller fill. It gets refused.

## The lock: no early exit

The liquidity goes into a **LiquidityLock**: 30 days, 90 days, a year, or forever.

- **No early exit.** Nobody can take the liquidity out before the date. Not the buyers, not a hacker, not you.
- **Fees still go to you.** The trading fees the pool earns can be collected at any time. Locked liquidity keeps working for whoever provided it.
- **Later, never sooner.** The owner can push the date further out. It can never be brought forward.

A lock set to forever never opens.

## The token: nothing hidden

The token UnyHooks mints is a plain ERC-20:

- fixed supply, minted once
- no owner
- no mint function
- no taxes
- no blocklist

Whatever share of the supply you don't put in the pool goes to your wallet, visibly, in the same transaction. No presale, no hidden allocation.

## Don't trust us either. Check.

This is the part we care about most. Everything above is a claim, and claims should be checked. So UnyHooks is built to be checked:

**Published source.** Every token, hook and lock is sent to Sourcify as it's deployed. Anyone can read the exact code that runs.

**Byte-for-byte checks.** The token and the lock have no settings baked into their code, so every genuine one is identical, byte for byte. The site compares a token's code with the original before it calls it an UnyHooks token. A copycat with the same name doesn't pass.

**A public page for every token.** Every launch gets a page anyone can open, without a wallet. It reads everything live from the chain, not from a database:

- what the hook does, from the hook's own settings
- whether the source is published
- how much of the pool's liquidity is locked, and until when
- whether launch protection is still on, with a countdown
- who launched it, and in which transaction

**A safety check for any token.** Paste any token on Robinhood Chain, made with UnyHooks or not, and the check reads:

- who owns it, if anyone
- whether it's an upgradeable proxy whose code can be swapped
- whether its code has functions to mint, pause, block wallets or change fees
- whether its source is public
- its Uniswap V4 pools, the hook on each and what that hook does
- how much of the liquidity is locked

Then it gives one verdict: looks clean, be careful, or high risk.

**Live numbers.** The homepage shows the launches made with UnyHooks, read straight from the chain: tokens launched, ETH paired, how many locked their liquidity, swaps through their hooks. A launch only counts if its token matches byte for byte.

**Open code.** The site and the contracts it deploys are on GitHub.

And to be straight with you: **the contracts have not been audited yet.** Until an outside firm reviews them, read the code, start small, and check everything. That's exactly why all of the above exists.

## Write your own hook

Launching is one thing UnyHooks does. The other is building hooks for any pool.

Describe what you want in plain words, for example *"send 2% of every swap to my treasury"* or *"only trade during market hours"*, and UnyHooks writes the Solidity. You read the contract, deploy it from your own wallet, create the pool and add liquidity, all from the browser.

Four kinds of hook today:

- **A fee on every swap.** A share of each trade, to a wallet or a treasury.
- **Dynamic fees.** The fee rises when the price moves fast and falls back when it calms.
- **Launch protection.** The anti-snipe rules above, for any token.
- **Trading hours.** The pool only trades inside a daily window. Made for the stock tokens on Robinhood Chain, so a pool can follow the market's hours.

Every setting is a constant. Once a hook is deployed, nobody can change it, the person who deployed it included. You hold the keys, the contracts and the pool. UnyHooks never does.

## Trade right on the page

Each token's page has a buy and sell panel. It swaps through Uniswap's own router, in the token's own pool, so the hook applies exactly as it would from any other app.

- The price is quoted before anything is signed, with your slippage limit shown.
- If the hook would refuse the trade, the panel tells you why first: a buy over the launch cap, or a wallet still in its cooldown.
- Every trade is dry-run before your wallet is asked to sign.

No more failed transactions with a cryptic error and lost gas.

## Why Robinhood Chain

Robinhood Chain brings Uniswap V4 to a chain built for real-world assets, stock tokens included, with low fees and fast blocks. That's where programmable pools make the most sense: launches that protect their first buyers, and markets that can follow real-world rules, like trading hours.

## $UHOOKS

$UHOOKS is the native token of UnyHooks on Robinhood Chain. Its contract address is announced only on the official site and on @UnyHooks. Always check the address on unyhooks.xyz before you interact with anything that claims to be it.

## What UnyHooks won't do

It won't make a token go up. A lock and a cap protect the launch; they don't create demand. A clean safety check isn't a guarantee either. It means the rules can't be changed under you, not that the price can't fall.

What it does is take the trust out of the parts that never needed it. The liquidity is locked because the code says so. The snipers are capped because the pool refuses them. The supply is fixed because there's no function to change it.

The rules are built in.

---

**Launch a token:** unyhooks.xyz
**Check any token:** unyhooks.xyz/check.html
**Follow:** @UnyHooks
