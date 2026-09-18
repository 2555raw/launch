/* Compiles src/ and test/mocks/ with solc and hands back the artifacts.
   Imports resolve against the node_modules that holds @openzeppelin. */
import solc from 'solc';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const require_ = createRequire(import.meta.url);

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith('.sol')) out.push(p);
  }
  return out;
}

const sources = {};
for (const p of [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'test', 'mocks'))]) {
  sources[p.slice(ROOT.length + 1)] = { content: readFileSync(p, 'utf8') };
}

function findImport(path) {
  try {
    if (path.startsWith('@')) return { contents: readFileSync(require_.resolve(path), 'utf8') };
    return { contents: readFileSync(resolve(ROOT, path), 'utf8') };
  } catch (e) {
    return { error: 'not found: ' + path + ' (' + e.message + ')' };
  }
}

const input = {
  language: 'Solidity',
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    // the deployment target: cancun is what Arbitrum-stack chains run today
    evmVersion: 'cancun',
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } },
  },
};

const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImport }));

const errors = (out.errors || []).filter(e => e.severity === 'error');
const warnings = (out.errors || []).filter(e => e.severity === 'warning');
if (errors.length) {
  for (const e of errors) console.error(e.formattedMessage);
  throw new Error(`${errors.length} compile error(s)`);
}

export const artifacts = {};
for (const [file, contracts] of Object.entries(out.contracts || {})) {
  for (const [name, c] of Object.entries(contracts)) {
    artifacts[name] = {
      abi: c.abi,
      bytecode: '0x' + c.evm.bytecode.object,
      deployedSize: c.evm.deployedBytecode.object.length / 2,
      file,
    };
  }
}

export const compileWarnings = warnings;

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`solc ${solc.version()}`);
  console.log(`${Object.keys(sources).length} source file(s) compiled, ${warnings.length} warning(s)`);
  for (const w of warnings) console.log('  warn: ' + (w.formattedMessage || '').split('\n')[0]);
  for (const [n, a] of Object.entries(artifacts)) {
    if (a.file.startsWith('src/')) console.log(`  ${n.padEnd(16)} ${String(a.deployedSize).padStart(6)} bytes deployed`);
  }
}
