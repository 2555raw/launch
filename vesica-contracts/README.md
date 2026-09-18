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

Two smaller asymmetries, on purpose: the guardian can pause but only the admin
can unpause, so a stolen guardian key can stall the vault but not reopen it;
and the 70 / 20 / 10 split is `constant`, not a setting, because the site
states it as a property of the protocol rather than a parameter.

## Running it

```
npm install
npm run build     # compile with solc 0.8.28, pinned
npm test          # 82 assertions on a real EVM
```

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

This is the vault, not the strategy. In the version the site draws, a deposit is
half-swapped into the Stock Token and put to work as a concentrated Uniswap
position that a keeper re-centres against the oracle. **None of that is written
here.** `totalAssets()` is the USDG the vault holds, and `harvest` takes fee
revenue from an address that already has it.

That missing piece is where most of the risk lives — the swap, the position
maths, the rebalance, and the MEV around all three — and it is what an audit
will spend most of its time on.

Before this holds real money:

- [ ] the strategy: the Uniswap position, the rebalance, the keeper
- [ ] port these tests to Foundry, which is what an auditor will expect, and
      add fuzz and invariant runs on top
- [ ] a testnet deployment the site points at, so the numbers on the page are
      real numbers
- [ ] an external audit, and the fixes that come back from it
- [ ] the admin key behind a timelock, and the guardian behind a multisig
- [ ] the legal question about tokenized equities answered, which is not a
      contract problem and is the longest pole
