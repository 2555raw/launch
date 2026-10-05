/* UnyHooks — compiles a hook in the browser.

   Runs solc 0.8.26 (the WebAssembly build from npm, via jsDelivr) in a worker so
   the page stays responsive, with the same compiler version and settings the
   hook tests use (scripts/hook-tests): evmVersion cancun, optimizer 200 runs.
   The Uniswap V4 files the hook imports come from vendor/v4-sources.json, so
   nothing else is fetched.

   Message in:  { id, file, contract, source }
   Message out: { id, ok: true, abi, bytecode, input, version } or { id, ok: false, error } */

const SOLJSON = 'https://cdn.jsdelivr.net/npm/solc@0.8.26/soljson.js';
const DEPS = 'vendor/v4-sources.json';

let compiler = null;
let deps = null;

function loadCompiler() {
  if (compiler) return compiler;
  self.Module = self.Module || {};
  importScripts(SOLJSON);
  const M = self.Module;
  compiler = {
    compile: M.cwrap('solidity_compile', 'string', ['string', 'number', 'number']),
    version: M.cwrap('solidity_version', 'string', [])()
  };
  return compiler;
}

self.onmessage = async (e) => {
  const { id, file, contract, source } = e.data || {};
  try {
    if (!deps) {
      const res = await fetch(DEPS);
      if (!res.ok) throw new Error(`could not load ${DEPS} (${res.status})`);
      deps = (await res.json()).sources;
    }
    const { compile, version } = loadCompiler();

    const sources = { [file]: { content: source } };
    for (const [path, content] of Object.entries(deps)) sources[path] = { content };
    const input = {
      language: 'Solidity',
      sources,
      settings: {
        evmVersion: 'cancun',
        optimizer: { enabled: true, runs: 200 },
        outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'metadata'] } }
      }
    };

    const out = JSON.parse(compile(JSON.stringify(input), 0, 0));
    const errors = (out.errors || []).filter((x) => x.severity === 'error');
    if (errors.length) throw new Error(errors.map((x) => x.formattedMessage || x.message).join('\n'));

    const c = out.contracts && out.contracts[file] && out.contracts[file][contract];
    if (!c || !c.evm.bytecode.object) throw new Error(`the compiler returned no bytecode for ${contract}`);

    self.postMessage({ id, ok: true, abi: c.abi, bytecode: '0x' + c.evm.bytecode.object, input, version });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
