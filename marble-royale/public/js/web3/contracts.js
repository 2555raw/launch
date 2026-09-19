/* The race, as a contract.

   Everything the app asks of a chain goes through one object with six
   calls - joinRace, getRace, getRaceParticipants, getRaceState,
   getRaceResults, claimPrize - and every call answers the same shapes
   whatever is behind it. Two things can be behind it:

     demo      the game server. Joining is a signed HTTP call, the pot is read
               off the fee wallet, and the winner is paid by hand. This is what
               runs today. It never says a transaction happened, because none
               did: a demo transaction goes idle → confirmed with no hash.

     onchain   a race contract, once one is deployed. Its methods are named
               and typed here and throw until an address is configured, so the
               app can be wired to it without changing a screen.

   A transaction is a small state machine the UI can show honestly:
   waiting_wallet → confirm → pending → confirmed | failed. */

(function () {
  'use strict';

  const api = async (path, body) => {
    const res = await fetch(path, body === undefined ? undefined : {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
    });
    const json = await res.json().catch(() => ({ error: 'bad response' }));
    if (!res.ok && !json.error) json.error = 'request failed';
    return json;
  };

  let seq = 0;
  const listeners = new Set();
  const emitTx = (tx) => { for (const fn of listeners) fn(tx); };

  /** @returns {import('../types').Transaction} */
  function newTx(kind) {
    return { id: 'tx' + (++seq) + '-' + Date.now().toString(36), kind, status: 'idle', hash: null, at: Date.now() };
  }

  /* ---- demo: the server is the source of truth ---------------------------- */

  const demo = {
    mode: 'demo',
    async getRace() { return (await api('/api/state')).round; },
    async getRaceState() { return (await api('/api/state')).round?.phase || null; },
    async getRaceParticipants() { return (await api('/api/state')).round?.players || []; },
    async getRaceResults(id) {
      const r = await api('/api/round?id=' + encodeURIComponent(id));
      return r.error ? null : r.round;
    },
    async getSchedule() { return (await api('/api/schedule')).schedule || []; },
    /** Join the open round. The "transaction" is the signed call to the server. */
    async joinRace(session, marble) {
      const tx = newTx('join');
      tx.status = 'confirm'; emitTx(tx);
      tx.status = 'pending'; emitTx(tx);
      const res = await api('/api/join', { token: session.token, color: marble.color, face: marble.face, material: marble.material, name: marble.name });
      if (res.error && !res.already) { tx.status = 'failed'; tx.error = res.error; emitTx(tx); return { tx, res }; }
      tx.status = 'confirmed'; emitTx(tx);
      return { tx, res };
    },
    async claimPrize() {
      /* The pot is sent by a person from the creator wallet; there is nothing
         for the winner to claim. Said so rather than faked. */
      const tx = newTx('claim');
      tx.status = 'failed'; tx.error = 'The pot is sent to the winning address by the creator. Nothing to claim.';
      emitTx(tx);
      return { tx };
    }
  };

  /* ---- on chain: named, typed, and honest about not being there yet ------- */

  const ABI = [
    'function joinRace(uint256 raceId) payable',
    'function getRace(uint256 raceId) view returns (uint256 id, uint8 state, uint256 startAt, uint256 prize, uint256 entry, uint256 maxPlayers)',
    'function getRaceParticipants(uint256 raceId) view returns (address[])',
    'function getRaceState(uint256 raceId) view returns (uint8)',
    'function getRaceResults(uint256 raceId) view returns (address[] order, uint256[] prizes)',
    'function claimPrize(uint256 raceId)'
  ];

  function onchain(address) {
    const notYet = () => { throw new Error('No race contract is configured on this network yet.'); };
    return {
      mode: 'onchain', address, abi: ABI,
      getRace: notYet, getRaceState: notYet, getRaceParticipants: notYet, getRaceResults: notYet,
      getSchedule: demo.getSchedule,
      /* The shape of a real join: the states the UI will show are the same,
         only here each one is a real step at the wallet. */
      async joinRace() {
        const tx = newTx('join');
        tx.status = 'waiting_wallet'; emitTx(tx);
        tx.status = 'failed'; tx.error = 'No race contract is configured on this network yet.'; emitTx(tx);
        return { tx, res: { error: tx.error } };
      },
      claimPrize: notYet
    };
  }

  /* ---- the launchpad: Pons on Robinhood Chain ------------------------------ */

  /* A launch is a real token on Robinhood Chain, made through Pons, the
     chain's launchpad: one transaction from the creator's own wallet to the
     Pons V2 factory, paying the launch fee the factory quotes. The token
     mints its whole supply into a bonding curve and trades from the first
     block; Pons, the explorers and the trading terminals that watch the Pons
     factory pick it up on their own. Nothing here holds a key. */
  const PONS = {
    chainId: 4663,
    chainHex: '0x1237',
    chainName: 'Robinhood Chain',
    rpc: 'https://rpc.mainnet.chain.robinhood.com',
    explorer: 'https://robinhoodchain.blockscout.com',
    site: 'https://ponsfamily.com',
    factory: '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e',
    launchConfigId: 0,
    pairToken: '0x0000000000000000000000000000000000000000',   // native ETH
    abi: [
      'function launchFee() view returns (uint256)',
      'function launchEnabled() view returns (bool)',
      'function canLaunch(address) view returns (bool)',
      'function launchToken((string name,string symbol,string logo,string description,(string twitter,string telegram,string discord,string website,string farcaster) socials,address creatorFeeRecipient,uint16 creatorTaxBps,bool buybackEnabled,bytes32 expectedEconomics,bytes32 salt) params,uint256 launchConfigId,address pairToken) payable returns (address token, address curve)',
      'event TokenLaunched(address indexed token,address indexed curve,address indexed deployer,address pairToken,uint256 launchConfigId,uint256 graduationThreshold)'
    ],
    /* the live factory's selector for that launchToken; checked before sending */
    selector: '0xf35abbcf'
  };

  const rejected = (err) => /reject|denied|cancel/i.test(String(err && (err.message || err)));

  /* The wallet on Robinhood Chain, added if the wallet does not know it. */
  async function onRobinhood(provider) {
    const have = parseInt(await provider.request({ method: 'eth_chainId' }), 16);
    if (have === PONS.chainId) return;
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: PONS.chainHex }] });
    } catch (err) {
      if (err && (err.code === 4902 || /unrecognized|not added|4902/i.test(String(err.message)))) {
        await provider.request({ method: 'wallet_addEthereumChain', params: [{
          chainId: PONS.chainHex, chainName: PONS.chainName, rpcUrls: [PONS.rpc],
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, blockExplorerUrls: [PONS.explorer]
        }] });
      } else throw err;
    }
  }

  const launchpad = {
    pons: PONS,
    get live() { return !!window.ethers; },
    /** The fee Pons charges right now, in wei, read from the factory. */
    async fee(provider) {
      const ethers = window.ethers;
      const bp = new ethers.BrowserProvider(provider);
      const factory = new ethers.Contract(PONS.factory, PONS.abi, bp);
      return factory.launchFee();
    },
    /**
     * Launches spec as a token on Pons from the connected wallet.
     * spec: { name, ticker, desc, image, twitter, telegram, website, buyback }
     * Resolves { tx, res } where res is { token, curve, hash, links } on success.
     */
    async createToken(session, spec) {
      const tx = newTx('launch');
      const provider = window.WALLET && WALLET.provider;
      const ethers = window.ethers;
      const fail = (msg) => { tx.status = 'failed'; tx.error = msg; emitTx(tx); return { tx, res: { error: msg } }; };
      if (!ethers) return fail('The chain library did not load; reload the page.');
      if (!provider || session.demo) return fail('Launching needs a real wallet (MetaMask, Phantom or any EVM wallet). A demo wallet cannot pay the launch fee.');
      if (!spec.name || !spec.ticker) return fail('A launch needs a name and a ticker.');
      tx.status = 'waiting_wallet'; emitTx(tx);
      try {
        await onRobinhood(provider);
        const bp = new ethers.BrowserProvider(provider);
        const signer = await bp.getSigner();
        const me = await signer.getAddress();
        const factory = new ethers.Contract(PONS.factory, PONS.abi, signer);
        const fn = factory.interface.getFunction('launchToken');
        if (fn.selector !== PONS.selector) return fail('The launch call does not match the Pons factory; not sending.');
        const [fee, enabled, can] = await Promise.all([factory.launchFee(), factory.launchEnabled().catch(() => true), factory.canLaunch(me).catch(() => true)]);
        if (!enabled) return fail('Pons has launches paused right now.');
        if (!can) return fail('This wallet is not allowed to launch on Pons right now.');
        const params = {
          name: String(spec.name).slice(0, 64),
          symbol: String(spec.ticker).toUpperCase().slice(0, 16),
          logo: String(spec.image || ''),
          description: String(spec.desc || ''),
          socials: { twitter: String(spec.twitter || ''), telegram: String(spec.telegram || ''), discord: '', website: String(spec.website || ''), farcaster: '' },
          creatorFeeRecipient: me,
          creatorTaxBps: 0,
          buybackEnabled: !!spec.buyback,
          expectedEconomics: ethers.ZeroHash,
          salt: ethers.hexlify(ethers.randomBytes(32))
        };
        tx.status = 'confirm'; tx.fee = fee; emitTx(tx);
        const sent = await factory.launchToken(params, PONS.launchConfigId, PONS.pairToken, { value: fee });
        tx.status = 'pending'; tx.hash = sent.hash; emitTx(tx);
        const receipt = await sent.wait();
        let token = null, curve = null;
        for (const log of receipt.logs) {
          try { const parsed = factory.interface.parseLog({ topics: [...log.topics], data: log.data }); if (parsed && parsed.name === 'TokenLaunched') { token = parsed.args.token; curve = parsed.args.curve; } } catch { /* another contract's log */ }
        }
        if (receipt.status !== 1) return fail('The launch transaction reverted. Nothing was deployed; the fee was not taken. ' + PONS.explorer + '/tx/' + sent.hash);
        tx.status = 'confirmed'; emitTx(tx);
        return { tx, res: { token, curve, hash: sent.hash, deployer: me, feeWei: fee.toString(), links: {
          tx: PONS.explorer + '/tx/' + sent.hash,
          token: token ? PONS.explorer + '/token/' + token : null,
          pons: token ? PONS.site + '/launchpad?search=' + token : PONS.site
        } } };
      } catch (err) {
        return fail(rejected(err) ? 'You cancelled in the wallet. Nothing was sent.' : (err && (err.shortMessage || err.message)) || 'The launch did not go through.');
      }
    }
  };

  let active = demo;
  window.CONTRACTS = {
    get launchpad() { return launchpad; },
    get mode() { return active.mode; },
    get race() { return active; },
    useDemo() { active = demo; },
    useOnchain(address) { active = onchain(address); },
    onTx: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    labels: {
      idle: 'Ready', waiting_wallet: 'Waiting for wallet', confirm: 'Confirm in your wallet',
      pending: 'Pending', confirmed: 'Confirmed', failed: 'Failed'
    }
  };
})();
