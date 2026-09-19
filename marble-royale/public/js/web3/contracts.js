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

  /* ---- the launchpad ------------------------------------------------------ */

  /* A launch is a token with races of its own. Today it is a draft kept in the
     browser; deploying it is one transaction to the launchpad contract, and
     until that contract has an address the deploy call fails with the truth
     rather than a fake receipt. */
  const LAUNCH_ABI = [
    'function createToken(string name, string symbol, string uri, uint32 raceEvery, uint16 winnerShareBps, uint256 minHold) payable returns (address token)'
  ];
  let launchpadAddress = '';
  const launchpad = {
    abi: LAUNCH_ABI,
    get address() { return launchpadAddress; },
    get live() { return !!launchpadAddress; },
    async createToken(session, spec) {
      const tx = newTx('launch');
      if (!launchpadAddress) {
        tx.status = 'failed'; tx.error = 'The launchpad contract is not live on this network yet. Your launch is saved as a draft.';
        emitTx(tx);
        return { tx, res: { error: tx.error, draft: true } };
      }
      tx.status = 'waiting_wallet'; emitTx(tx);
      tx.status = 'failed'; tx.error = 'Deploying is not wired to a wallet in this build.'; emitTx(tx);
      return { tx, res: { error: tx.error } };
    }
  };

  let active = demo;
  window.CONTRACTS = {
    get launchpad() { return launchpad; },
    useLaunchpad(address) { launchpadAddress = address || ''; },
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
