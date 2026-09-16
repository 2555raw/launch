/* Launching a coin on Robinhood Chain, through Pons.
 *
 * The Solana side of this wallet builds Meteora's instructions by hand because
 * nothing else could. Here that work is unnecessary: Robinhood Chain is an EVM
 * chain, ethers is already vendored, and ethers encodes calldata from an ABI.
 * So this file is an ABI, an address, and the shape of one call.
 *
 * Both came from Pons's own repository rather than from a search result or a
 * blog, and the difference mattered: the address that circulates in write-ups
 * is the V2 factory, but the abi.json in that repo's root describes the *V1*
 * deployment, which is a different contract with a different flow. These are
 * read from the README's deployment table and from the V2 Solidity source:
 *
 *   V2 factory  0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e   (chain 4663)
 *
 * The struct below is transcribed field by field from TokenParams in
 * contractsV2/src/v2/PonsV2LaunchFactory.sol. Order is everything in ABI
 * encoding: two strings swapped is a coin with its description as its name,
 * and it cannot be edited afterwards. test/pons.js checks the order against
 * that source and recomputes the selector from the signature rather than
 * trusting what ethers returns.
 *
 * What is deliberately NOT hardcoded: which launchConfigId to use, what the
 * factory charges, and whether launching is open at all. The factory owns
 * those and can change them between one launch and the next, so discover()
 * reads them from the chain at the moment of launching. This machine cannot
 * reach a node, but the browser running this can, which is the whole reason
 * that works. */

window.WARD_PONS = (function () {
  const CHAIN_ID = 4663;
  const FACTORY = '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e';

  /* Transcribed from PonsV2LaunchFactory.sol. The tuple is TokenParams; the
     nested tuple is PonsV2LauncherToken.Socials, whose five strings are in the
     order twitter, telegram, discord, website, farcaster. */
  const ABI = [
    'function launchToken(' +
      '(string name,string symbol,string logo,string description,' +
      '(string twitter,string telegram,string discord,string website,string farcaster) socials,' +
      'address creatorFeeRecipient,uint16 creatorTaxBps,bool buybackEnabled,' +
      'bytes32 expectedEconomics,bytes32 salt) params,' +
      'uint256 launchConfigId,address pairToken' +
    ') payable returns (address token, address curve)',
    /* Quoted at signing time and pinned into the launch, so an owner re-peg
       cannot land underneath a launch already in flight. */
    'function previewLaunchEconomics(uint256 launchConfigId,address pairToken) view returns (bytes32)',
    'function canLaunch(address launcher) view returns (bool)',
    'function launchFee() view returns (uint256)',
    'function launchEnabled() view returns (bool)',
    'function launchConfigCount() view returns (uint256)',
    /* LaunchConfig, in the order it is declared in the source. */
    'function getLaunchConfig(uint256 id) view returns (' +
      '(uint256 supply,uint256 curveFeeBps,uint256 phantomQuote,uint256 graduationThreshold,' +
      'uint24 poolFee,int24 tickSpacing,bool enabled))'
  ];

  /* The launch is CREATE2, so the salt fixes the token's address. It only has
     to be unique among this account's own launches; random is enough, and
     mining it is how someone would choose a vanity address. */
  const salt = () => '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  /* Builds TokenParams from what the launch form collects. Empty strings are
     deliberate rather than omitted: the ABI has no notion of an absent field,
     and the contract stores these on chain, so a coin with no Telegram carries
     an empty one. */
  function params(o) {
    return {
      name: o.name || '',
      symbol: o.symbol || '',
      logo: o.logo || '',
      description: o.description || '',
      socials: {
        twitter: o.twitter || '',
        telegram: o.telegram || '',
        discord: o.discord || '',
        website: o.website || '',
        farcaster: o.farcaster || ''
      },
      creatorFeeRecipient: o.creator,
      creatorTaxBps: o.creatorTaxBps || 0,
      buybackEnabled: !!o.buybackEnabled,
      /* Zero waives the check. It is filled from previewLaunchEconomics at
         signing time, which is the only safe way to produce it. */
      expectedEconomics: o.expectedEconomics || '0x' + '0'.repeat(64),
      salt: o.salt || salt()
    };
  }

  const iface = E => new E.Interface(ABI);

  /* The calldata for one launch. Returned rather than sent, so the caller can
     estimate gas, show a fee and let someone change their mind. */
  function launchCall(E, o) {
    return {
      to: FACTORY,
      data: iface(E).encodeFunctionData('launchToken', [params(o), o.launchConfigId, o.pairToken]),
      value: o.launchFee || 0n
    };
  }

  /* Quoting a launch is not a thing to hardcode: the factory owns the curve
     configurations, sets its own fee and can turn launching off, and all of it
     can change between one launch and the next. This machine cannot reach the
     chain, but the browser running this can, so the terms are read at the
     moment of launching rather than pinned into the source.

     pairToken address(0) is a launch quoted in the chain's own coin. An
     approved ERC-20 would go here instead, and the curve figures would then be
     in that asset's decimals rather than in wei. */
  const NATIVE = '0x0000000000000000000000000000000000000000';

  async function discover(provider, me, E) {
    const c = new E.Contract(FACTORY, ABI, provider);
    const [open, fee, count] = await Promise.all([
      c.canLaunch(me), c.launchFee(), c.launchConfigCount()
    ]);
    if (!open) return { open: false };

    /* The first configuration the factory says is enabled. Reading them rather
       than assuming id 0 means a disabled or retired one cannot be launched
       against by accident. */
    let id = null, cfg = null;
    for (let i = 0n; i < count; i++) {
      const got = await c.getLaunchConfig(i);
      if (got.enabled) { id = i; cfg = got; break; }
    }
    if (id === null) return { open: false, noConfig: true };

    /* Quoted now and pinned into the launch, so an owner re-peg cannot land
       underneath a launch already in flight. */
    const economics = await c.previewLaunchEconomics(id, NATIVE);
    return {
      open: true, launchFee: fee, launchConfigId: id, pairToken: NATIVE,
      expectedEconomics: economics,
      supply: cfg.supply, curveFeeBps: cfg.curveFeeBps,
      graduationThreshold: cfg.graduationThreshold
    };
  }

  return {
    /* Filled by discover() at launch time rather than written here. */
    config: null,
    NATIVE, CHAIN_ID, FACTORY, ABI,
    params, launchCall, salt, iface, discover
  };
})();
