// Compiles the Nebari contracts with solc-js and writes ABI + bytecode to build/.
// Usage: node scripts/compile.js            (from neberi-site/contracts, after npm install)
const fs = require('fs');
const path = require('path');
const solc = require('solc');

const root = path.resolve(__dirname, '..');
const nm = path.join(root, 'node_modules');

const sources = {};
for (const f of fs.readdirSync(path.join(root, 'src'))) {
  if (f.endsWith('.sol')) sources['src/' + f] = { content: fs.readFileSync(path.join(root, 'src', f), 'utf8') };
}
const extra = process.argv.slice(2); // extra entry files, e.g. test helpers
for (const f of extra) sources[f] = { content: fs.readFileSync(path.join(root, f), 'utf8') };

function findImports(p) {
  const candidates = [path.join(nm, p), path.join(root, p)];
  for (const c of candidates) if (fs.existsSync(c)) return { contents: fs.readFileSync(c, 'utf8') };
  return { error: 'not found: ' + p };
}

const input = {
  language: 'Solidity',
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: 'cancun',
    viaIR: true,
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } },
  },
};

const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
let failed = false;
for (const e of out.errors || []) {
  if (e.severity === 'error') failed = true;
  console.error(e.formattedMessage);
}
if (failed) process.exit(1);

const build = path.join(root, 'build');
fs.mkdirSync(build, { recursive: true });
for (const file of Object.keys(out.contracts)) {
  for (const name of Object.keys(out.contracts[file])) {
    const c = out.contracts[file][name];
    if (!c.evm.bytecode.object) continue; // interfaces and libraries with nothing to deploy
    const keep = file.startsWith('src/') || extra.includes(file) || (extra.length > 0 && ['PoolManager', 'TestERC20'].includes(name));
    if (!keep) continue;
    fs.writeFileSync(path.join(build, name + '.json'), JSON.stringify({
      contractName: name, abi: c.abi, bytecode: '0x' + c.evm.bytecode.object,
      deployedSize: c.evm.deployedBytecode.object.length / 2,
    }, null, 2));
    console.log('built', name, '(' + c.evm.deployedBytecode.object.length / 2 + ' bytes)');
  }
}
