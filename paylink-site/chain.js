/* PayLink, version 1.1. The chain layer.
   No dependencies. Everything the pages need to talk to Robinhood Chain and
   Ethereum from the browser: a JSON-RPC client, keccak-256, an ABI encoder and
   decoder, wallet helpers, and the Blockscout lookups. Exposed as window.PL.
   Nothing here holds a key. Every write goes through the user's own wallet. */

(() => {
  'use strict';

  /* ---------- constants ---------- */

  const CHAIN = {
    id: 4663,
    hexId: '0x1237',
    name: 'Robinhood Chain',
    rpcs: ['https://rpc.mainnet.chain.robinhood.com', 'https://robinhood-rpc.publicnode.com', 'https://rpc.arrowrpc.com'],
    explorer: 'https://robinhoodchain.blockscout.com',
    currency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  };
  const ETH = {
    id: 1,
    rpcs: ['https://ethereum-rpc.publicnode.com', 'https://eth.llamarpc.com', 'https://cloudflare-eth.com'],
    explorer: 'https://etherscan.io',
  };
  const ADDR = {
    factory:  '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e',
    escrow:   '0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e',
    usdg:     '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
    pyusd:    '0x6c3ea9036406852006290770BEdFcAbA0e23A0e8',
    curve:    '0x383E6b4437b59fff47B619CBA855CA29342A8559',
    platform: '0x782899412Cd27071A40D0C3aAa2536eD75B9854E',
  };

  /* ---------- bytes and hex ---------- */

  const hexToBytes = (h) => { h = h.replace(/^0x/, ''); if (h.length % 2) h = '0' + h; const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16); return o; };
  const bytesToHex = (b) => '0x' + [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  const utf8 = (s) => new TextEncoder().encode(s);
  const isAddress = (s) => /^0x[0-9a-fA-F]{40}$/.test(String(s || '').trim());

  /* ---------- keccak-256 ---------- */

  const M64 = (1n << 64n) - 1n;
  const RC = [0x1n, 0x8082n, 0x800000000000808an, 0x8000000080008000n, 0x808bn, 0x80000001n, 0x8000000080008081n, 0x8000000000008009n, 0x8an, 0x88n, 0x80008009n, 0x8000000an, 0x8000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n, 0x8000000000008002n, 0x8000000000000080n, 0x800an, 0x800000008000000an, 0x8000000080008081n, 0x8000000000008080n, 0x80000001n, 0x8000000080008008n];
  const ROT = [[0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61], [28, 55, 25, 21, 56], [27, 20, 39, 8, 14]];
  const rotl = (v, n) => n ? (((v << BigInt(n)) | (v >> BigInt(64 - n))) & M64) : v;
  const keccakF = (A) => {
    for (let r = 0; r < 24; r++) {
      const C = [], D = [];
      for (let x = 0; x < 5; x++) C[x] = A[x] ^ A[x + 5] ^ A[x + 10] ^ A[x + 15] ^ A[x + 20];
      for (let x = 0; x < 5; x++) D[x] = C[(x + 4) % 5] ^ rotl(C[(x + 1) % 5], 1);
      for (let i = 0; i < 25; i++) A[i] ^= D[i % 5];
      const B = new Array(25);
      for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) B[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(A[x + 5 * y], ROT[x][y]);
      for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) A[x + 5 * y] = B[x + 5 * y] ^ ((~B[(x + 1) % 5 + 5 * y] & M64) & B[(x + 2) % 5 + 5 * y]);
      A[0] ^= RC[r];
    }
  };
  const keccak256 = (input) => {
    const bytes = typeof input === 'string' ? utf8(input) : input;
    const rate = 136, A = new Array(25).fill(0n);
    const padded = new Uint8Array(Math.ceil((bytes.length + 1) / rate) * rate);
    padded.set(bytes); padded[bytes.length] ^= 0x01; padded[padded.length - 1] ^= 0x80;
    for (let off = 0; off < padded.length; off += rate) {
      for (let i = 0; i < rate / 8; i++) { let v = 0n; for (let b = 7; b >= 0; b--) v = (v << 8n) | BigInt(padded[off + i * 8 + b]); A[i] ^= v; }
      keccakF(A);
    }
    const out = new Uint8Array(32);
    for (let i = 0; i < 4; i++) { let v = A[i]; for (let b = 0; b < 8; b++) { out[i * 8 + b] = Number(v & 0xffn); v >>= 8n; } }
    return out;
  };
  const checksum = (addr) => {
    const a = addr.toLowerCase().replace(/^0x/, '');
    const h = bytesToHex(keccak256(a)).slice(2);
    return '0x' + [...a].map((c, i) => parseInt(h[i], 16) >= 8 ? c.toUpperCase() : c).join('');
  };

  /* ---------- ABI ---------- */

  const sigOf = (fn) => `${fn.name}(${fn.inputs.map(typeOf).join(',')})`;
  const typeOf = (p) => p.type === 'tuple' ? `(${p.components.map(typeOf).join(',')})` : p.type.startsWith('tuple') ? `(${p.components.map(typeOf).join(',')})${p.type.slice(5)}` : p.type;
  const selector = (fn) => bytesToHex(keccak256(sigOf(fn))).slice(0, 10);
  const topicOf = (ev) => bytesToHex(keccak256(sigOf(ev)));

  const pad32 = (hex) => hex.replace(/^0x/, '').padStart(64, '0');
  const isDynamic = (p) => p.type === 'string' || p.type === 'bytes' || p.type.endsWith('[]') || (p.type.startsWith('tuple') && p.components.some(isDynamic));
  const toBig = (v) => typeof v === 'bigint' ? v : BigInt(String(v).trim());

  const encodeOne = (p, v) => {
    const t = p.type;
    const arr = t.match(/^(.*)\[(\d*)\]$/);
    if (arr) {
      const inner = { ...p, type: arr[1] };
      const items = v.map((x) => encodeOne(inner, x));
      const body = encodeTuple(items.map(() => inner), v);
      return arr[2] === '' ? pad32(v.length.toString(16)) + body : body;
    }
    if (t === 'tuple') return encodeTuple(p.components, p.components.map((c, i) => Array.isArray(v) ? v[i] : v[c.name]));
    if (t === 'address') { if (!isAddress(v)) throw new Error('bad address: ' + v); return pad32(v.slice(2).toLowerCase()); }
    if (t === 'bool') return pad32(v ? '1' : '0');
    if (/^u?int\d*$/.test(t)) { let n = toBig(v); if (n < 0n) n = (1n << 256n) + n; return pad32(n.toString(16)); }
    if (/^bytes\d+$/.test(t)) return v.replace(/^0x/, '').padEnd(64, '0');
    if (t === 'string' || t === 'bytes') {
      const b = t === 'string' ? utf8(v) : hexToBytes(v);
      return pad32(b.length.toString(16)) + (bytesToHex(b).slice(2).padEnd(Math.ceil(b.length / 32) * 64, '0'));
    }
    throw new Error('unsupported type ' + t);
  };
  const encodeTuple = (params, values) => {
    const heads = [], tails = [];
    let headLen = params.length * 32;
    params.forEach((p, i) => { if (isDynamic(p)) tails.push(encodeOne(p, values[i])); else { const e = encodeOne(p, values[i]); heads.push(e); headLen += e.length / 2 - 32; } });
    let out = '', tail = '', offset = params.reduce((n, p) => n + (isDynamic(p) ? 32 : encodeOne(p, values[params.indexOf(p)]).length / 2), 0);
    let ti = 0;
    params.forEach((p, i) => {
      if (isDynamic(p)) { out += pad32(offset.toString(16)); const e = tails[ti++]; tail += e; offset += e.length / 2; }
      else out += encodeOne(p, values[i]);
    });
    return out + tail;
  };
  const encodeCall = (fn, values) => selector(fn) + encodeTuple(fn.inputs, values);

  const decodeOne = (p, hex, pos) => {
    const t = p.type, word = (at) => hex.substr(at * 2, 64);
    const arr = t.match(/^(.*)\[(\d*)\]$/);
    if (arr) {
      const inner = { ...p, type: arr[1] };
      let base = pos, n = Number(arr[2]);
      if (arr[2] === '') { n = parseInt(word(pos), 16); base = pos + 32; }
      return decodeTuple(Array(n).fill(inner), hex, base);
    }
    if (t === 'tuple') return decodeTuple(p.components, hex, pos);
    if (t === 'address') return checksum('0x' + word(pos).slice(24));
    if (t === 'bool') return word(pos).slice(-1) === '1';
    if (/^uint\d*$/.test(t)) return BigInt('0x' + word(pos));
    if (/^int\d*$/.test(t)) { let n = BigInt('0x' + word(pos)); if (n >> 255n) n -= 1n << 256n; return n; }
    if (/^bytes\d+$/.test(t)) return '0x' + word(pos).slice(0, parseInt(t.slice(5)) * 2);
    if (t === 'string' || t === 'bytes') { const len = parseInt(word(pos), 16); const b = hexToBytes(hex.substr((pos + 32) * 2, len * 2)); return t === 'string' ? new TextDecoder().decode(b) : bytesToHex(b); }
    throw new Error('unsupported type ' + t);
  };
  const decodeTuple = (params, hex, base = 0) => {
    const out = []; let pos = base;
    params.forEach((p) => {
      if (isDynamic(p)) { const off = parseInt(hex.substr(pos * 2, 64), 16); out.push(decodeOne(p, hex, base + off)); pos += 32; }
      else { out.push(decodeOne(p, hex, pos)); pos += staticSize(p); }
    });
    return out;
  };
  const staticSize = (p) => { const arr = p.type.match(/^(.*)\[(\d+)\]$/); if (arr) return Number(arr[2]) * staticSize({ ...p, type: arr[1] }); if (p.type === 'tuple') return p.components.reduce((n, c) => n + staticSize(c), 0); return 32; };
  const decodeResult = (fn, hex) => decodeTuple(fn.outputs || [], hex.replace(/^0x/, ''));

  /* ---------- JSON-RPC ---------- */

  const rpc = async (rpcs, method, params = []) => {
    let last;
    for (const url of rpcs) {
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
        const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: ctl.signal });
        clearTimeout(t);
        const j = await r.json();
        if (j.error) throw new Error(j.error.message || 'rpc error');
        return j.result;
      } catch (e) { last = e; }
    }
    throw last || new Error('no rpc answered');
  };
  const call = async (rpcs, to, fn, args = []) => decodeResult(fn, await rpc(rpcs, 'eth_call', [{ to, data: encodeCall(fn, args) }, 'latest']));

  const ERC20 = {
    name:      { name: 'name', inputs: [], outputs: [{ type: 'string' }] },
    symbol:    { name: 'symbol', inputs: [], outputs: [{ type: 'string' }] },
    decimals:  { name: 'decimals', inputs: [], outputs: [{ type: 'uint8' }] },
    balanceOf: { name: 'balanceOf', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
    Transfer:  { name: 'Transfer', inputs: [{ type: 'address', indexed: true }, { type: 'address', indexed: true }, { type: 'uint256' }] },
  };
  const token = async (rpcs, addr) => {
    const [[name], [symbol], [decimals]] = await Promise.all([call(rpcs, addr, ERC20.name), call(rpcs, addr, ERC20.symbol), call(rpcs, addr, ERC20.decimals)]);
    return { name, symbol, decimals: Number(decimals) };
  };
  const fmt = (raw, decimals, places = 2) => { const n = Number(raw) / 10 ** decimals; return n.toLocaleString('en-US', { minimumFractionDigits: places, maximumFractionDigits: places }); };

  /* ---------- Blockscout ---------- */

  const bs = async (path) => { const r = await fetch(CHAIN.explorer + '/api/v2' + path, { headers: { accept: 'application/json' } }); if (!r.ok) throw new Error('explorer ' + r.status); return r.json(); };
  const abiOf = async (addr) => {
    const c = await bs('/smart-contracts/' + addr);
    let abi = c.abi || [];
    if (c.implementations && c.implementations.length) {
      try { const impl = await bs('/smart-contracts/' + c.implementations[0].address); if (impl.abi) abi = abi.concat(impl.abi); } catch (_) { /* proxy without a verified target */ }
    }
    return { name: c.name || null, verified: !!c.is_verified, abi, proxy: !!(c.implementations && c.implementations.length) };
  };
  const tokenTransfers = (addr, tokenAddr) => bs(`/addresses/${addr}/token-transfers?type=ERC-20&token=${tokenAddr}`);

  /* ---------- wallet ---------- */

  const wallet = {
    has: () => !!(window.ethereum && window.ethereum.request),
    connect: async () => { const a = await window.ethereum.request({ method: 'eth_requestAccounts' }); return checksum(a[0]); },
    chainId: async () => parseInt(await window.ethereum.request({ method: 'eth_chainId' }), 16),
    switchTo: async () => {
      try { await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN.hexId }] }); }
      catch (e) {
        if (e.code !== 4902 && !/unrecognized|not added|4902/i.test(e.message || '')) throw e;
        await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: CHAIN.hexId, chainName: CHAIN.name, rpcUrls: [CHAIN.rpcs[0]], nativeCurrency: CHAIN.currency, blockExplorerUrls: [CHAIN.explorer] }] });
      }
    },
    send: (tx) => window.ethereum.request({ method: 'eth_sendTransaction', params: [tx] }),
  };

  /* ---------- finding the right function in an ABI ---------- */

  const writable = (abi) => abi.filter((f) => f.type === 'function' && f.stateMutability !== 'view' && f.stateMutability !== 'pure');
  const readable = (abi) => abi.filter((f) => f.type === 'function' && (f.stateMutability === 'view' || f.stateMutability === 'pure'));
  const score = (fn, want) => want.reduce((n, re) => n + (re.test(fn.name) ? 1 : 0), 0);
  const findLaunch = (abi) => {
    const c = writable(abi).filter((f) => f.inputs.some((i) => i.type === 'string') && f.inputs.some((i) => i.type === 'address'));
    c.sort((a, b) => score(b, [/creat/i, /launch/i, /deploy/i, /token/i]) - score(a, [/creat/i, /launch/i, /deploy/i, /token/i]));
    return c[0] || null;
  };
  const findSetRecipient = (abi) => {
    const c = writable(abi).filter((f) => f.inputs.filter((i) => i.type === 'address').length >= 2);
    c.sort((a, b) => score(b, [/recipient/i, /fee/i, /transfer/i, /set/i]) - score(a, [/recipient/i, /fee/i, /transfer/i, /set/i]));
    return c[0] || null;
  };
  const findGetRecipient = (abi) => {
    const c = readable(abi).filter((f) => f.inputs.length === 1 && f.inputs[0].type === 'address' && (f.outputs || []).some((o) => o.type === 'address'));
    c.sort((a, b) => score(b, [/recipient/i, /fee/i, /creator/i]) - score(a, [/recipient/i, /fee/i, /creator/i]));
    return c[0] || null;
  };
  const roleOf = (input) => {
    const n = (input.name || '').toLowerCase();
    if (input.type === 'address') { if (/recipient|feeto|creator|payee|receiver|benef/.test(n)) return 'recipient'; if (/pair|quote|base|token|currency|asset/.test(n)) return 'pair'; return null; }
    if (input.type === 'string') { if (/symbol|ticker/.test(n)) return 'ticker'; if (/name/.test(n)) return 'name'; if (/desc|meta|uri|image|url/.test(n)) return 'description'; return null; }
    return null;
  };

  window.PL = { CHAIN, ETH, ADDR, ERC20, isAddress, checksum, keccak256, bytesToHex, hexToBytes, selector, topicOf, encodeCall, decodeResult, rpc, call, token, fmt, abiOf, tokenTransfers, wallet, writable, readable, findLaunch, findSetRecipient, findGetRecipient, roleOf };
})();
