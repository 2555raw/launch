# LilyPadLauncher

One contract, one job: call the public Pons V2 factory and make the creator's first buy in the
same transaction. Without it, a launch with a first buy is three signatures (launch, approve,
buy) and the buy lands in a later block, where anyone can front-run it. With it, it is two
signatures (approve the stock to the launcher, launch) and the buy is atomic with the launch.

```
launch(TokenParams params, uint256 launchConfigId, address pairToken,
       address[] exemptions, uint256 quoteIn, uint256 minTokensOut)
  payable → (address token, address curve, uint256 tokensOut)
```

- `msg.value` must equal `pons.launchFee()`.
- `params.creatorFeeRecipient` must be the caller: the human stays the fee recipient even though
  the factory records the launcher as `deployer`.
- `exemptions` should contain the caller and the launcher address (the curve sees the launcher as
  the buyer of the first purchase; Pons allows up to 32 addresses).
- `quoteIn` of the stock must be approved to the launcher beforehand. Unspent stock and ETH go back
  to the caller before the call returns; the launcher never holds funds.
- Emits `Launched(user, token, curve, pairToken, quoteIn, tokensOut)`, which the site's adapter
  reads to attribute the pair to its human creator.

## Deploy

```bash
forge create contracts/pons/LilyPadLauncher.sol:LilyPadLauncher \
  --rpc-url https://rpc.mainnet.chain.robinhood.com \
  --private-key $PK \
  --constructor-args 0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e \
  --verify --verifier blockscout --verifier-url https://robinhoodchain.blockscout.com/api/
```

Then tell the site about it, before the scripts load:

```html
<script>window.BONDED_PONS = { launcher: '0xYourLauncher' };</script>
```

Without `launcher` the adapter still works: it launches directly on the factory and sends the
first buy as a second transaction, and the launch page says so.

## Before relying on it

- Check `pons.canLaunch(<launcher>)` with `scripts/verify-pons.mjs --launcher 0x…`. If the factory
  rate-limits launches per address, a shared launcher would hit that limit; the script tells you.
- Check that the snipe-tax exemption applies to the buyer the curve sees. If it is the recipient
  rather than `msg.sender`, the launcher address in `exemptions` is harmless but unnecessary.
- This contract is short and unaudited. Read it before deploying it.
