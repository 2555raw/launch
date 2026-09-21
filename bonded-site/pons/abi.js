/* Minimal ABI codec + JSON-RPC client for Pons V2. No dependencies.
   Exposes globalThis.bdAbi = { encode, decode, call, selector, topic, rpc, ... }.
   Types supported: address, bool, uintN, intN, bytes32, string, bytes,
   T[] (dynamic arrays) and tuples written as an array of component types.
   Requires pons/keccak.js to be loaded first. */
(function () {
  const keccak = () => globalThis.bdKeccak256;
  const strip = (h) => h.startsWith('0x') ? h.slice(2) : h;
  const pad32 = (hex) => strip(hex).padStart(64, '0');
  const toHex = (bytes) => '0x' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const utf8 = (s) => new TextEncoder().encode(s);
  const MASK = (1n << 256n) - 1n;

  // A type is a string ('address', 'uint256', 'string', 'address[]') or
  // { tuple: [types...] } for structs, or { array: type } for T[].
  const isDynamic = (t) => {
    if (typeof t === 'string') return t === 'string' || t === 'bytes' || t.endsWith('[]');
    if (t.tuple) return t.tuple.some(isDynamic);
    return true;
  };
  const norm = (t) => {
    if (typeof t === 'string' && t.endsWith('[]')) return { array: t.slice(0, -2) };
    return t;
  };

  function encodeWord(t, v) {
    if (t === 'address') return pad32(v.toLowerCase());
    if (t === 'bool') return pad32(v ? '1' : '0');
    if (t.startsWith('uint')) return pad32(BigInt(v).toString(16));
    if (t.startsWith('int')) return pad32((BigInt(v) & MASK).toString(16));
    if (t.startsWith('bytes')) return strip(v).padEnd(64, '0');
    throw new Error('abi: unknown static type ' + t);
  }

  function encodeOne(type, v) {
    const t = norm(type);
    if (typeof t === 'string') {
      if (t === 'string' || t === 'bytes') {
        const bytes = t === 'string' ? utf8(v) : (typeof v === 'string' ? hexToBytes(v) : v);
        const body = strip(toHex(bytes)).padEnd(Math.ceil(bytes.length / 32) * 64, '0');
        return pad32(bytes.length.toString(16)) + body;
      }
      return encodeWord(t, v);
    }
    if (t.array) return pad32(v.length.toString(16)) + encodeTuple(v.map(() => t.array), v);
    if (t.tuple) return encodeTuple(t.tuple, v);
    throw new Error('abi: bad type');
  }

  function encodeTuple(types, values) {
    const heads = [], tails = [];
    // head size: 32 per dynamic slot, the full encoding for static ones (nested static tuples included)
    const headLen = types.reduce((n, t, i) => n + (isDynamic(t) ? 32 : encodeOne(t, values[i]).length / 2), 0);
    let tailLen = 0;
    types.forEach((t, i) => {
      const enc = encodeOne(t, values[i]);
      if (isDynamic(t)) { heads.push(pad32((headLen + tailLen).toString(16))); tails.push(enc); tailLen += enc.length / 2; }
      else heads.push(enc);
    });
    return heads.join('') + tails.join('');
  }

  function hexToBytes(h) {
    const s = strip(h);
    const out = new Uint8Array(s.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
    return out;
  }

  // ---- decoding -------------------------------------------------------
  function decodeWord(t, w) {
    if (t === 'address') return '0x' + w.slice(24);
    if (t === 'bool') return BigInt('0x' + w) !== 0n;
    if (t.startsWith('uint')) return BigInt('0x' + w);
    if (t.startsWith('int')) { const n = BigInt('0x' + w); return n > (MASK >> 1n) ? n - (MASK + 1n) : n; }
    if (t.startsWith('bytes')) return '0x' + w.slice(0, parseInt(t.slice(5) || '32') * 2);
    throw new Error('abi: unknown static type ' + t);
  }

  function decodeTuple(types, data, base = 0) {
    const out = [];
    let off = base;
    const word = (o) => data.slice(o * 2, o * 2 + 64);
    for (const type of types) {
      const t = norm(type);
      if (isDynamic(t)) {
        const ptr = base + Number(BigInt('0x' + word(off)));
        out.push(decodeDynamic(t, data, ptr));
        off += 32;
      } else if (typeof t === 'string') {
        out.push(decodeWord(t, word(off))); off += 32;
      } else {
        const { values, size } = decodeStaticTuple(t.tuple, data, off);
        out.push(values); off += size;
      }
    }
    return out;
  }
  function decodeStaticTuple(types, data, off) {
    const start = off;
    const values = [];
    for (const type of types) {
      const t = norm(type);
      if (typeof t === 'string') { values.push(decodeWord(t, data.slice(off * 2, off * 2 + 64))); off += 32; }
      else { const r = decodeStaticTuple(t.tuple, data, off); values.push(r.values); off += r.size; }
    }
    return { values, size: off - start };
  }
  function decodeDynamic(t, data, ptr) {
    const word = (o) => data.slice(o * 2, o * 2 + 64);
    if (t === 'string' || t === 'bytes') {
      const len = Number(BigInt('0x' + word(ptr)));
      const raw = data.slice((ptr + 32) * 2, (ptr + 32) * 2 + len * 2);
      return t === 'string' ? new TextDecoder().decode(hexToBytes(raw)) : '0x' + raw;
    }
    if (t.array) {
      const len = Number(BigInt('0x' + word(ptr)));
      return decodeTuple(Array(len).fill(t.array), data, ptr + 32);
    }
    if (t.tuple) return decodeTuple(t.tuple, data, ptr);
    throw new Error('abi: bad dynamic type');
  }

  // ---- signatures -----------------------------------------------------
  const typeName = (t) => typeof t === 'string' ? t : t.array ? typeName(t.array) + '[]' : '(' + t.tuple.map(typeName).join(',') + ')';
  const selector = (name, types) => keccak()(name + '(' + types.map(typeName).join(',') + ')').slice(0, 10);
  const topic = (name, types) => keccak()(name + '(' + types.map(typeName).join(',') + ')');
  const encodeCall = (name, types, values) => selector(name, types) + encodeTuple(types, values);
  const decodeResult = (types, hex) => decodeTuple(types, strip(hex));

  // ---- JSON-RPC -------------------------------------------------------
  function makeRpc(url, fetchImpl) {
    const f = fetchImpl || globalThis.fetch;
    let id = 0;
    return async function rpc(method, params = []) {
      const res = await f(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) });
      if (!res.ok) throw new Error(`rpc ${method}: HTTP ${res.status}`);
      const j = await res.json();
      if (j.error) { const e = new Error(`rpc ${method}: ${j.error.message}`); e.data = j.error.data; e.code = j.error.code; throw e; }
      return j.result;
    };
  }

  // Decode an Error(string) revert reason when present.
  // custom errors a launch factory or curve is likely to throw; the selector is matched at runtime
  const KNOWN_ERRORS = ['LaunchDisabled()', 'LaunchesDisabled()', 'NotLaunchable()', 'CannotLaunch()', 'NotAllowed()', 'Unauthorized()', 'Paused()', 'EnforcedPause()',
    'InvalidPairToken()', 'PairTokenNotApproved()', 'UnapprovedPairToken()', 'InvalidQuote()', 'InvalidFee()', 'IncorrectFee()', 'WrongFee()', 'InsufficientFee()', 'FeeMismatch()',
    'EconomicsMismatch()', 'StaleEconomics()', 'InvalidEconomics()', 'InvalidConfig()', 'ConfigDisabled()', 'InvalidLaunchConfig()', 'LaunchConfigDisabled()',
    'CreatorTaxTooHigh()', 'InvalidCreatorTax()', 'TaxTooHigh()', 'InvalidRecipient()', 'ZeroAddress()', 'InvalidSalt()', 'SaltInUse()', 'TokenExists()', 'AlreadyDeployed()',
    'TooManyExemptions()', 'InvalidName()', 'InvalidSymbol()', 'NameTooLong()', 'SymbolTooLong()', 'EmptyName()', 'EmptySymbol()', 'InvalidMetadata()', 'InvalidLogo()',
    'Graduated()', 'NotGraduated()', 'Slippage()', 'InsufficientOutput()', 'ZeroAmount()', 'Reentrancy()', 'ReentrancyGuardReentrantCall()', 'CurveClosed()', 'Cooldown()', 'RateLimited()'];
  let knownBySelector = null;
  function errorName(selector) {
    if (!knownBySelector) { knownBySelector = {}; for (const sig of KNOWN_ERRORS) knownBySelector[keccak()(sig).slice(0, 10)] = sig; }
    return knownBySelector[selector] || null;
  }
  function revertReason(err) {
    const d = typeof err?.data === 'string' ? err.data : (err?.data?.data || err?.data?.originalError?.data || err?.error?.data);
    if (typeof d === 'string' && d.length >= 10) {
      if (d.startsWith('0x08c379a0')) { try { return decodeTuple(['string'], d.slice(10))[0]; } catch { /* fallthrough */ } }
      if (d.startsWith('0x4e487b71')) { try { return 'panic 0x' + decodeTuple(['uint256'], d.slice(10))[0].toString(16); } catch { /* fallthrough */ } }
      const sel = d.slice(0, 10);
      return (errorName(sel) || `custom error ${sel}`) + (d.length > 10 ? ` (${d.slice(10, 74)}…)` : '');
    }
    return err?.message || String(err);
  }

  globalThis.bdAbi = {
    encodeTuple, decodeTuple, encodeCall, decodeResult, selector, topic, typeName,
    makeRpc, revertReason, errorName, hexToBytes, toHex, pad32, strip,
    hex: (n) => '0x' + BigInt(n).toString(16),
    // fixed-point helpers
    toUnits: (amount, decimals) => {
      const [i, f = ''] = String(amount).split('.');
      return BigInt(i || '0') * 10n ** BigInt(decimals) + BigInt((f + '0'.repeat(decimals)).slice(0, decimals) || '0');
    },
    fromUnits: (n, decimals) => Number(n) / 10 ** decimals,
  };
})();
