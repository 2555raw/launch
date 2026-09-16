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

  /* Walks backwards from the head in windows, because a public node will
     refuse a request that spans the whole chain, and stops as soon as enough
     launches have been found or the search has gone far enough back to be
     worth giving up on. */
  async function launches(want = 12, windowSize = 50000, maxWindows = 12) {
    const head = hexToNum(await rpc('eth_blockNumber', []));
    const found = [];
    let to = head;
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
      for (const l of logs.reverse()) {
        found.push({
          token: addrOf(l.topics[1]),
          curve: addrOf(l.topics[2]),
          deployer: addrOf(l.topics[3]),
          block: hexToNum(l.blockNumber),
          tx: l.transactionHash
        });
        if (found.length >= want) break;
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

  async function recent(want = 12) {
    const found = await launches(want);
    return Promise.all(found.map(describe));
  }

  const tokenUrl = a => EXPLORER + '/token/' + a;
  const txUrl = h => EXPLORER + '/tx/' + h;

  return { RPC, FACTORY, EXPLORER, TOPIC_LAUNCHED, SEL,
           rpc, recent, launches, describe, readString, addrOf, tokenUrl, txUrl };
})();
