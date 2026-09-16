/* Every coin launched through Pons, read straight off Robinhood Chain.
 *
 * This runs on the landing page, which does not load ethers and should not
 * start: a visitor reading about a wallet has no business downloading one.
 * So the few things normally borrowed from a library are here instead, and
 * they are small because only two shapes are ever decoded — an address out of
 * a log topic, and a string out of an eth_call return.
 *
 * The one thing that cannot be computed without keccak-256, which browsers do
 * not provide, is the event topic and the function selectors. Those are
 * written down, and test/feed.js recomputes every one of them from its
 * signature and fails on a mismatch, so a wrong digit cannot survive.
 *
 * What this lists is every launch on Pons, not only the ones made through
 * Ward. There is no Ward marker on chain to filter by, and inventing one would
 * mean claiming other people's coins or hiding real ones. The heading says so.
 */

window.WARD_FEED = (function () {
  const RPC = 'https://rpc.mainnet.chain.robinhood.com';
  const FACTORY = '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e';
  const EXPLORER = 'https://robinhoodchain.blockscout.com';

  /* keccak-256 of the signatures, which the browser cannot compute. Checked
     against those signatures in the tests rather than trusted here. */
  const TOPIC_LAUNCHED = '0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607';
  const SEL = { name: '0x06fdde03', symbol: '0x95d89b41', info: '0xabb1dc44' };

  let id = 0;
  async function rpc(method, params) {
    const r = await fetch(RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params })
    });
    if (!r.ok) throw new Error('rpc ' + r.status);
    const j = await r.json();
    if (j.error) throw new Error(j.error.message || 'rpc error');
    return j.result;
  }

  const hexToNum = h => parseInt(h, 16);
  /* A log topic is a 32-byte word; an address is its last twenty bytes. */
  const addrOf = topic => '0x' + topic.slice(-40);

  /* One dynamic string out of an eth_call return. `slot` is which of the
     returned values it is, counting from zero: the word at that position is an
     offset into the payload, where a length is followed by the bytes. */
  function readString(hex, slot) {
    const b = hex.startsWith('0x') ? hex.slice(2) : hex;
    const word = i => b.slice(i * 64, (i + 1) * 64);
    const at = hexToNum(word(slot)) * 2;
    const len = hexToNum(b.slice(at, at + 64)) * 2;
    const body = b.slice(at + 64, at + 64 + len);
    let out = '';
    for (let i = 0; i < body.length; i += 2) out += '%' + body.slice(i, i + 2);
    try { return decodeURIComponent(out); } catch { return ''; }
  }

  const call = (to, data) => rpc('eth_call', [{ to, data }, 'latest']);

  /* Was this launch made through Ward?
     The event does not say, and there is no field on it that could. But the
     launch is CREATE2 and its salt is a free 32 bytes that Ward begins with
     "WARD" in ASCII, so the answer is in the calldata of the transaction that
     emitted the event.
     Reading it by hand: the call is launchToken(TokenParams, uint256, address).
     TokenParams holds strings, so it is dynamic and its first word is an offset
     to where the tuple really starts. Inside that tuple the first five fields
     are also dynamic and occupy one word each as offsets, then come five
     static ones. The salt is the last of them, so it is word nine of the tuple.
     A claim rather than a proof: anyone can write the same four bytes. */
  const WARD_TAG = '57415244';
  const word = (b, i) => b.slice(i * 64, (i + 1) * 64);

  function saltOf(input) {
    const b = (input || '').replace(/^0x/, '').slice(8);   // past the selector
    if (b.length < 64 * 3) return null;
    const tuple = hexToNum(word(b, 0)) * 2;
    const salt = b.slice(tuple + 9 * 64, tuple + 10 * 64);
    return salt.length === 64 ? salt.toLowerCase() : null;
  }

  /* Coins launched from Ward before the salt carried that mark. The mark is
     six days younger than the launchpad, so the first launches out of Ward
     are plain random salts and no rule can pick them out of the chain; they
     are named here because the alternative is a front page that says Ward has
     never launched anything. Addresses only, checked against the same chain
     as everything else, and nothing is added to this list that was not
     launched from Ward. */
  const EARLY = [
    /* '0x...'  token address */
  ].map(a => a.toLowerCase());

  async function fromWard(t) {
    if (EARLY.indexOf((t.token || '').toLowerCase()) !== -1) return true;
    try {
      const tx = await rpc('eth_getTransactionByHash', [t.tx]);
      const salt = tx && saltOf(tx.input);
      return !!salt && salt.startsWith(WARD_TAG);
    } catch { return false; }
  }

  /* How many salts are asked after at once. */
  const RUN = 12;

  const launchOf = l => ({
    token: addrOf(l.topics[1]),
    curve: addrOf(l.topics[2]),
    deployer: addrOf(l.topics[3]),
    block: hexToNum(l.blockNumber),
    tx: l.transactionHash
  });

  /* Walks backwards from the head in windows, because a public node will
     refuse a request that spans the whole chain, and stops as soon as enough
     launches have been found or the search has gone far enough back to be
     worth giving up on.

     `keep` decides what counts towards that enough. It matters more than it
     looks: without it the Ward tab had to ask for a big pile of launches and
     sieve it afterwards, so the depth it really searched was however far back
     that pile happened to reach. On a busy day that is an hour, and a coin
     launched yesterday was not missing from the chain, only from the pile.
     Counting after the sieve instead means the search goes as deep as it has
     to, and the windows are the only limit. */
  async function launches(want = 12, windowSize = 50000, maxWindows = 12,
                          keep = null, budget = 240) {
    const head = hexToNum(await rpc('eth_blockNumber', []));
    const found = [];
    let left = budget, to = head;
    for (let w = 0; w < maxWindows && found.length < want && to > 0; w++) {
      const from = Math.max(0, to - windowSize);
      let logs = [];
      try {
        logs = await rpc('eth_getLogs', [{
          address: FACTORY, topics: [TOPIC_LAUNCHED],
          fromBlock: '0x' + from.toString(16), toBlock: '0x' + to.toString(16)
        }]);
      } catch { /* a window the node would not serve: try an older one */ }
      /* Newest first within the window. */
      const here = logs.reverse().map(launchOf);
      if (!keep) {
        for (const t of here) { found.push(t); if (found.length >= want) break; }
      } else {
        /* A run at a time, asked for together. Each of these is a second call
           to the node, so they go in parallel and against a budget: without
           one, a tab that finds nothing would walk the whole search asking
           after every launch on the chain, and the node would be right to
           stop answering. Running out of budget means the list is short, not
           that it is complete, which is what the empty line on the page
           says. */
        for (let i = 0; i < here.length && found.length < want && left > 0; i += RUN) {
          const run = here.slice(i, Math.min(i + RUN, i + left));
          left -= run.length;
          const flags = await Promise.all(run.map(keep));
          for (let k = 0; k < run.length; k++) {
            if (!flags[k]) continue;
            found.push(run[k]);
            if (found.length >= want) break;
          }
        }
        if (left <= 0) break;
      }
      to = from - 1;
    }
    return found;
  }

  /* The event carries addresses, not a name. The rest lives on the token. */
  async function describe(t) {
    const [name, symbol, info] = await Promise.all([
      call(t.token, SEL.name).catch(() => null),
      call(t.token, SEL.symbol).catch(() => null),
      call(t.token, SEL.info).catch(() => null)
    ]);
    return Object.assign({}, t, {
      name: name ? readString(name, 0) : '',
      symbol: symbol ? readString(symbol, 0) : '',
      /* getTokenInfo returns (address, string, string, Socials); the two
         strings are the second and third values. */
      logo: info ? readString(info, 1) : '',
      description: info ? readString(info, 2) : ''
    });
  }

  /* `mine` asks for launches made through Ward. Each one costs a second call,
     to read the salt out of the transaction that made it, and the sieve runs
     inside the walk so that the depth searched is a stretch of chain rather
     than a number of other people's launches. */
  async function recent(want = 12, mine = false) {
    const found = await launches(want, 50000, 12, mine ? fromWard : null);
    return Promise.all(found.map(describe));
  }

  /* Watching for launches as they land.
     Polling rather than a subscription because this is a public HTTP node and
     a websocket would be one more thing to keep open and reconnect. Only the
     blocks since the last look are asked for, so a quiet minute costs two
     small calls, and nothing is asked at all while the tab is in the
     background. */
  function watch(onNew, { every = 12000, mine = false } = {}) {
    let last = null, stopped = false, timer = null;

    async function tick() {
      if (stopped) return;
      try {
        const head = hexToNum(await rpc('eth_blockNumber', []));
        if (last === null) { last = head; return; }
        if (head > last) {
          const logs = await rpc('eth_getLogs', [{
            address: FACTORY, topics: [TOPIC_LAUNCHED],
            fromBlock: '0x' + (last + 1).toString(16),
            toBlock: '0x' + head.toString(16)
          }]);
          last = head;
          /* Oldest first here, so prepending one at a time leaves the newest
             on top when several land in the same window. */
          for (const l of logs) {
            const t = { token: addrOf(l.topics[1]), curve: addrOf(l.topics[2]),
                        deployer: addrOf(l.topics[3]), block: hexToNum(l.blockNumber),
                        tx: l.transactionHash };
            if (mine && !(await fromWard(t))) continue;
            onNew(await describe(t));
          }
        }
      } catch { /* a node that blinked; the next tick picks the gap up */ }
      finally { if (!stopped) timer = setTimeout(tick, document.hidden ? every * 5 : every); }
    }

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !stopped) { clearTimeout(timer); tick(); }
    });
    tick();
    return { stop() { stopped = true; clearTimeout(timer); }, seen: b => { last = b; } };
  }

  /* A picture a coin put on chain. ipfs:// is common and is not something a
     browser can fetch, so it goes through a gateway; anything that is not one
     of these two is refused rather than guessed at. */
  const IPFS = 'https://ipfs.io/ipfs/';
  function picture(logo) {
    const s = (logo || '').trim();
    if (/^https:\/\//i.test(s)) return s;
    if (/^ipfs:\/\//i.test(s)) return IPFS + s.replace(/^ipfs:\/\/(ipfs\/)?/i, '');
    return null;
  }

  const tokenUrl = a => EXPLORER + '/token/' + a;
  const txUrl = h => EXPLORER + '/tx/' + h;

  return { RPC, FACTORY, EXPLORER, TOPIC_LAUNCHED, SEL,
           WARD_TAG, EARLY, rpc, recent, launches, describe, readString, addrOf,
           saltOf, fromWard, watch, picture, IPFS, tokenUrl, txUrl };
})();
