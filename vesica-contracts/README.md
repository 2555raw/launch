# Vesica contracts

The onchain half of the vault the site describes. Two contracts, both small
enough to read in a sitting, and a test suite that runs them on a real EVM.

**Nothing here is deployed anywhere, and none of it has been audited.** It is
not to hold anyone's money until both of those change. See *What is missing*.

## What is here

| | |
| --- | --- |
| `src/VesicaVault.sol` | An ERC-4626 vault denominated in USDG. Deposits, a cap, a guardian pause, an oracle check, and `harvest`, which splits fee revenue 70 / 20 / 10. |
| `src/ChainlinkGate.sol` | The check run before the vault will take money: is the sequencer up and past its grace period, and is the price recent enough to act on. |
| `src/VesicaStrategy.sol` | The concentrated Uniswap V3 position. USDG in, half becomes the Stock Token, the pair goes to work in a band around the oracle price. Rebalancing, fee collection, and the pool's callbacks. |
| `src/libraries/TickMath.sol` | Uniswap's, moved to 0.8 — generated from theirs, not retyped, and checked against their own build. |
| `src/libraries/LiquidityAmounts.sol` | Uniswap's formulas on OpenZeppelin's `mulDiv`, checked against their own build. |
| `src/libraries/OraclePrice.sol` | A Chainlink quote turned into the sqrt price a pool speaks. Everything the strategy decides hangs off this and never off the pool. |

The 70% of a harvest is not sent anywhere. It stays in the vault, which raises
`totalAssets` against an unchanged share count — and that is the share price
rising. It is the whole mechanism the site's diagram describes, and
`test/run.mjs` asserts it in those terms.

## Three properties it is built to hold

1. **Withdrawals are never pausable.** The guardian can stop deposits and stop
   harvests. It cannot stop anyone leaving. A pause that traps depositors is
   indistinguishable from a rug, so the power to do it is not in the contract.
2. **A dead oracle stops money coming in, never money going out.** Exiting is
   priced off the vault's own balance, not off a feed, so a stale feed must not
   become a lock.
3. **Rounding always favours the vault.** A deposit-and-redeem round trip never
   ends ahead; the dust stays with the depositors.

Each of the three has tests named after it. If a change breaks one, the test
that fails says which promise was broken.

The strategy is the dangerous contract, and it carries three rules of its own:

4. **The oracle prices, the pool only executes.** `totalAssets` is computed
   from the Chainlink quote and never from `slot0`. A pool's spot price is
   whatever the previous line of the same transaction left behind, and a flash
   loan can leave behind anything. Vaults that priced themselves off spot are
   the single most repeated way this shape of contract has been emptied.
   `test/strategy.mjs` has an attacker move the pool 8.6% and asserts the
   valuation does not shift one wei — then moves the oracle and asserts it does.
5. **No swap runs unbounded.** Every swap carries a price limit derived from
   the oracle and is measured again afterwards against what the oracle said it
   should have fetched. A swap that stops short of its limit is refused
   outright rather than left as a lopsided partial fill.
6. **Rebalancing is permissioned, banded and rate-limited.** It moves the
   position, so an attacker who could call it freely could walk the vault into
   a range of their choosing and trade against it.

Rule 5 is deliberately one-sided. Buying below the oracle price is not a loss
to defend against — whoever moved the pool paid for that discount — so the
vault takes it. Only getting less than the oracle says is refused.

Two smaller asymmetries, on purpose: the guardian can pause but only the admin
can unpause, so a stolen guardian key can stall the vault but not reopen it;
and the 70 / 20 / 10 split is `constant`, not a setting, because the site
states it as a property of the protocol rather than a parameter.

## Running it

```
npm install
npm run build     # compile with solc 0.8.28, pinned
npm test          # 131 assertions on a real EVM
```

| suite | what it holds |
| --- | --- |
| `test/tickmath.mjs` | the TickMath port against sqrt(1.0001^tick)·2^96 computed in Python at 140 digits, and against Uniswap's own 0.7.6 build — 431 ticks, byte-identical both directions. Matching an independent value proves the maths; matching the original proves the transcription. |
| `test/liquidity.mjs` | the liquidity maths against Uniswap's own build, 1,066 comparisons across tight and wide ranges with the price below, inside and above each. |
| `test/run.mjs` | the vault: the deposit arithmetic, the cap, the pause that must still let people out, the stale feed that must still let people out, the split to the basis point, the rounding, the inflation attack, a re-entrant asset. |
| `test/strategy.mjs` | the strategy against a real Uniswap V3 pool — Uniswap's shipped bytecode, deployed by Uniswap's own factory. Includes the manipulation attack, a sandwich set up in the direction that actually pays, and a full round trip costing 0.29%. |

The tests execute the real compiled bytecode. Nothing about the vault is
stubbed — only the world around it: the block clock, the Chainlink feeds, and
the ERC-20 the vault is denominated in. `test/chain.mjs` is that world, in
about 130 lines.

What the suite covers: the gate against a sequencer that is down, inside its
grace period, and back; against a stale price, a negative price, and an answer
carried over from an earlier round. The vault against a deposit's arithmetic, a
cap that is exactly full, a pause that must still let people out, a stale feed
that must still let people out, the split to the basis point, the rounding dust,
a fee-on-transfer asset, two depositors sharing a harvest, the first-depositor
inflation attack, and an asset that calls back in mid-transfer.

## What is missing

**The vault and the strategy are not yet wired to each other.** Each is tested
on its own: the vault holds idle USDG and takes fee revenue from an address
that already has it, and the strategy is driven directly by an address standing
in for the vault. Joining them means the vault's `totalAssets` has to include
the strategy's, and a withdrawal has to pull from the position when the idle
balance will not cover it. That is the next commit, and it is not a formality —
it is the path every withdrawal takes.

Two known gaps in the strategy itself, both marked in the source:

- Fees earned since the last `collectFees` are not counted by `totalAssets`,
  because reading them needs a state-changing poke. It understates the vault,
  which is safe against theft but slightly unfair to existing holders, so the
  keeper should collect often.
- A pool that has drifted further from the oracle than `maxSlippageBps` cannot
  be traded at all — deposits and rebalances into it revert with
  `PoolDislocated`. Refusing is the safe behaviour, but it means a violent move
  can stall deposits until someone arbitrages the pool back.

Before this holds real money:

- [ ] wire the vault to the strategy, and test the withdrawal path that has to
      pull liquidity to pay out
- [ ] port these tests to Foundry, which is what an auditor will expect, and
      add fuzz and invariant runs on top
- [ ] a testnet deployment the site points at, so the numbers on the page are
      real numbers
- [ ] an external audit, and the fixes that come back from it
- [ ] the admin key behind a timelock, and the guardian behind a multisig
- [ ] the legal question about tokenized equities answered, which is not a
      contract problem and is the longest pole
