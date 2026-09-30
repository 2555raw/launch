// Compiles contracts/yuelong with solc-js and writes out/artifacts.json { name: { abi, bytecode } }
import solc from 'solc';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = {};
const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.sol')) files[path.relative(ROOT, p)] = { content: fs.readFileSync(p, 'utf8') }; } };
walk(ROOT); for (const k of Object.keys(files)) if (k.startsWith('node_modules') || k.startsWith('out')) delete files[k];
const input = { language: 'Solidity', sources: files, settings: { optimizer: { enabled: true, runs: 2000 }, viaIR: true, evmVersion: 'paris', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } } } };
const out = JSON.parse(solc.compile(JSON.stringify(input), { import: p => files[p] ? { contents: files[p].content } : { error: 'not found ' + p } }));
let bad = false;
for (const e of out.errors || []) { if (e.severity === 'error') bad = true; if (e.severity === 'error' || !/SPDX|pragma|Unused|shadow/i.test(e.message)) console.log(e.severity + ': ' + e.formattedMessage.trim()); }
if (bad) process.exit(1);
const art = {};
for (const [file, cs] of Object.entries(out.contracts)) for (const [name, c] of Object.entries(cs)) art[name] = { file, abi: c.abi, bytecode: '0x' + c.evm.bytecode.object, size: c.evm.deployedBytecode.object.length / 2 };
const OUT = path.join(ROOT, 'out'); fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'artifacts.json'), JSON.stringify(art));
for (const [n, a] of Object.entries(art)) if (a.size) console.log(n.padEnd(20), a.size, 'bytes');

// the site reads the ABIs on every page and the bytecode only on its admin page, where the
// owner can deploy from a browser wallet
const SITE = path.join(ROOT, '..', 'assets', 'chain');
const USED = ['YuelongFactory', 'YuelongCurve', 'YuelongToken', 'YuelongRouter', 'YuelongPool', 'PoolGraduator', 'WrappedNative'];
const DEPLOYED = ['YuelongFactory', 'YuelongRouter', 'PoolGraduator', 'WrappedNative'];
fs.mkdirSync(SITE, { recursive: true });
fs.writeFileSync(path.join(SITE, 'abi.json'), JSON.stringify(Object.fromEntries(USED.map(n => [n, art[n].abi]))));
fs.writeFileSync(path.join(SITE, 'bytecode.json'), JSON.stringify(Object.fromEntries(DEPLOYED.map(n => [n, art[n].bytecode]))));
