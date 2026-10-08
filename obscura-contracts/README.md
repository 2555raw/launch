# obscura-contracts

Smart contracts for the **proposed** HeldAt token (`$HELD`) and its bond NFT.

> **NOT AUDITED. NOT DEPLOYED.** These contracts have only been checked by the unit tests in this folder. Get an independent audit before you put real money behind them. "HeldAt", "$HELD" and every figure below are placeholders. The owner chooses the final values at deploy time.

The proposal on the landing page (`obscura-site/index.html#token`) is a 0.30% fee on buys, paid in $HELD, with 80% burned and 20% sent to a prover pool, and a bond NFT that only $HELD holders can mint. None of these figures is a constant in the code. Each one is a constructor argument, and some can also be changed later by the owner, up to a hard cap.

## Contracts

### `contracts/HELD.sol`: ERC-20 with a buy fee

- OpenZeppelin v5 `ERC20` + `Ownable2Step`, 18 decimals.
- The whole supply is minted once, in the constructor, to the deployer.
- **Buy fee.** When tokens move **from** an address the owner has marked as an AMM pair (a buy), the contract takes `feeBps` of the amount:
  - `fee = floor(amount * feeBps / 10000)`
  - `burned = floor(fee * burnShareBps / 10000)`. This is a real burn, so `totalSupply` goes down.
  - `toProverPool = fee - burned`. The prover pool gets the rounding remainder.
  - The buyer receives `amount - fee`. The pair is debited exactly `amount`, so the AMM's accounting is unaffected.
  - The contract emits `BuyFeeTaken(pair, buyer, fee, burned, toProverPool)`.
- **No fee** on sells (transfers to a pair), on wallet-to-wallet transfers, on anything sent from or to a fee-exempt address, or when `feeBps == 0`.
- **What this contract does NOT have:** no mint function after deployment (the supply is fixed), no blacklist or freeze of individual wallets, no pause, no maximum wallet or maximum transaction size, no cooldowns, no rebasing. The fee can never go above `MAX_FEE_BPS` = 1%, and nobody can change that cap.

| Parameter | Set by | Range / cap | Proposal | Event |
|---|---|---|---|---|
| `name`, `symbol` | constructor | any | "HeldAt" / "HELD" (placeholders) | none |
| `initialSupply` | constructor | any, in the smallest unit (wei) | owner's choice | ERC-20 `Transfer` from 0x0 |
| `feeBps` | constructor, `setFeeBps` | 0 to **100** (1%), hard cap `MAX_FEE_BPS` | 30 (0.30%) | `FeeBpsUpdated` |
| `burnShareBps` | constructor, `setBurnShareBps` | 0 to 10000 (share of the fee) | 8000 (80%) | `BurnShareBpsUpdated` |
| `proverPool` | constructor, `setProverPool` | any non-zero address | a multisig or contract | `ProverPoolUpdated` |
| `isPair[addr]` | `setPair(addr, bool)` | non-zero address | the $HELD pool | `PairUpdated` |
| `isFeeExempt[addr]` | `setFeeExempt(addr, bool)` | non-zero address | none (see notes) | `FeeExemptUpdated` |
| owner | `transferOwnership` + `acceptOwnership`, `renounceOwnership` | | deployer, then a multisig or renounced | `OwnershipTransferStarted`, `OwnershipTransferred` |

`previewBuyFee(amount)` returns `(fee, burned, toProverPool)` at the current settings.

### `contracts/BondNFT.sol`: bond NFT gated on holding $HELD

- OpenZeppelin v5 `ERC721` + `Ownable2Step`.
- `mint(bytes32 sealCode)` mints to `msg.sender`. It reverts if:
  - `sealCode` is zero (`ZeroSealCode`)
  - the seal code is already bonded (`SealCodeAlreadyBonded`)
  - `held.balanceOf(msg.sender) < minHold` (`InsufficientHELD`)
- Token ids run 1, 2, 3, and so on. A successful mint emits `Bonded(tokenId, owner, sealCode)`. All three fields are indexed.
- `sealCodeOf(tokenId)` returns the seal code and reverts for a token that does not exist. `tokenIdOfSeal(sealCode)` returns the token id for a seal code, or 0 if the code has not been bonded.
- The token stores only the seal code. There is no asset, no amount and no off-chain link.
- `tokenURI` is fully on-chain: `data:application/json;base64,…` with `name: "Bond #<id>"`, a `Seal code` attribute (0x-prefixed hex) and a small inline SVG image.
- **Soulbound flag.** The deployer fixes it in the constructor and it can never change. When it is on, minting works and every transfer reverts with `Soulbound`.

| Parameter | Set by | Range / cap | Event |
|---|---|---|---|
| `name`, `symbol` | constructor | any | none |
| `held` | constructor (immutable) | non-zero | none |
| `maxMinHold` | constructor (immutable) | any. This is the hard cap on `minHold` | none |
| `minHold` | constructor, `setMinHold` | 1 to `maxMinHold`, in the smallest unit | `MinHoldUpdated` |
| `soulbound` | constructor (immutable) | true / false | none |
| owner | as for HELD | | as for HELD |

## Running the tests

Requires Node 18+.

```sh
cd obscura-contracts
npm install
npm test            # = npx hardhat test
```

The tests use Hardhat 2 with its in-process network, solc 0.8.28 (optimizer 200 runs, EVM target `cancun`) and OpenZeppelin Contracts 5.4.0. The suite has 40 tests. They cover supply, fee only on buys from a pair, the exact burn/prover split and rounding, the fee cap, exemptions, ownership and renounce, the NFT hold gate, zero and duplicate seal codes, `sealCodeOf`, soulbound behaviour, and decoding `tokenURI` to JSON. Foundry could not be installed in the build environment (its download was blocked), so the project uses Hardhat.

No network, RPC URL or private key is configured anywhere in this folder.

## Deploy checklist (for the owner)

1. **Final values.** Choose the name, ticker, total supply, `feeBps` (≤ 100), `burnShareBps`, the prover pool address, `minHold`, `maxMinHold` and the soulbound flag. Update the landing page to match.
2. **Prover pool.** Use a multisig (for example Safe) or a contract, not a personal wallet.
3. **Audit.** Have the final code audited. Rerun `npm test` on the exact commit you deploy.
4. **Rehearse on a testnet.** Do steps 5 to 10 on Sepolia or Base Sepolia first. Then run a real buy and sell through the router you will use and check that the fee, burn and prover amounts are what you expect.
5. **Deploy `HELD`** with `(name, symbol, initialSupply, feeBps, burnShareBps, proverPool)`. The whole supply goes to the deploying wallet.
6. **Create the pool.** Use a Uniswap V2-style pair, HELD/WETH. Before you add liquidity, call `setFeeExempt(<your LP wallet>, true)` so that removing liquidity later is not charged as a "buy" (see notes).
7. **`setPair(<pool address>, true)`.** Do this before trading opens.
8. **Deploy `BondNFT`** with `(name, symbol, heldAddress, minHold, maxMinHold, soulbound)`.
9. **Verify both contracts** on Etherscan or Basescan with the same compiler settings: `npx hardhat verify --network <net> <address> <constructor args…>`. You must add the network and an API key to `hardhat.config.js` locally first, and you should never commit them.
10. **Hand over or renounce.** Use `transferOwnership(<multisig>)`, then call `acceptOwnership()` from the multisig. Or call `renounceOwnership()` to freeze every setting forever, including pairs, exemptions and the prover pool address. Renouncing is irreversible: no new pool can ever be added and the prover pool can never be moved.
11. **Publish the addresses** only through the official channel the site names, and update the site.

## Notes and known trade-offs

- **This is a fee-on-transfer token on buys.** The buyer receives 0.30% less than the router's quote. On Uniswap V2, swaps need the `...SupportingFeeOnTransferTokens` router functions or enough slippage tolerance. Uniswap V3 pools also work, because the pool only checks its input-token balance, but quotes shown in interfaces will be about 0.30% high. **Do not mark a Uniswap V4 PoolManager (or any shared vault) as a pair.** It holds every pool's tokens, so every withdrawal from it would be charged.
- **Liquidity removal looks like a buy.** When LP tokens are burned, the pair sends HELD to the LP. That is a transfer from a pair, so the fee is charged unless the recipient is exempt.
- **The hold gate is checked only at mint time.** A wallet can mint and then sell its HELD, or borrow HELD for a single transaction. The gate is a speed bump, not a lock.
- **Renouncing freezes the configuration, not the fee.** After renounce the fee keeps working at its last setting forever.
- The owner can raise the fee again (up to 1%) after lowering it. If you want "can only go down", that is a one-line change. See the open questions.
