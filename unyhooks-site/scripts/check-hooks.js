/* Compiles every UnyHooks template and its Foundry deploy script, across a
   spread of settings, against the real Uniswap V4 sources and forge-std.
   Exits non-zero on any compiler error. Behaviour is tested in hook-tests/.

     npm i --no-save solc @uniswap/v4-core @uniswap/v4-periphery
     node scripts/check-hooks.js

   Run from unyhooks-site/ (or point NODE_PATH at a node_modules that has them). */

const fs = require('fs');
const path = require('path');
const solc = require('solc');
const B = require('../builder.js');

const resolveImport = (p) => {
  // v4-periphery imports v4-core as @uniswap/v4-core/...; both are npm packages.
  // forge-std ships inside v4-core's lib/.
  const candidates = [p, p.replace(/^forge-std\//, '@uniswap/v4-core/lib/forge-std/src/')];
  for (const c of candidates) {
    try { return { contents: fs.readFileSync(require.resolve(c, { paths: [process.cwd(), __dirname] }), 'utf8') }; } catch (_) { /* next */ }
  }
  return { error: `not found: ${p}` };
};

const ADDR = '0x1111111111111111111111111111111111111111';
const CASES = [
  ['fee', { feePercent: 1, recipient: ADDR }],
  ['fee', { feePercent: 0.01, recipient: ADDR }],
  ['fee', { feePercent: 10, recipient: ADDR }],
  ['dynamic', {}],
  ['dynamic', { floorPercent: 0.3, ceilingPercent: 0.3, fullMovePercent: 0.1, windowMinutes: 1 }],
  ['dynamic', { floorPercent: 0.01, ceilingPercent: 10, fullMovePercent: 50, windowMinutes: 1440 }],
  ['launch', { token: ADDR }],
  ['launch', { token: ADDR, maxBuy: 0.000001, pairDecimals: 18, cooldownSeconds: 0, windowMinutes: 1 }],
  ['launch', { token: ADDR, maxBuy: 2500, pairDecimals: 6, cooldownSeconds: 1, windowMinutes: 10080 }],
  ['hours', {}],
  ['hours', { open: '22:00', close: '04:30', weekdaysOnly: false }],
  ['hours', { open: '0:00', close: '23:59', weekdaysOnly: true }]
];

let failed = 0;
for (const [recipe, settings] of CASES) {
  const out = B.generate(recipe, settings);
  if (out.problems.length) { console.log('PROBLEMS', recipe, settings, out.problems); failed++; continue; }
  const input = {
    language: 'Solidity',
    // The hook as src/, the deploy script as script/, the way a Foundry project lays them out.
    sources: { [`src/${out.file}`]: { content: out.source }, [`script/${out.scriptFile}`]: { content: out.script } },
    settings: { evmVersion: 'cancun', viaIR: false, optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['evm.bytecode.object'] } } }
  };
  const res = JSON.parse(solc.compile(JSON.stringify(input), { import: resolveImport }));
  const errors = (res.errors || []).filter((e) => e.severity === 'error');
  const ours = [`src/${out.file}`, `script/${out.scriptFile}`];
  const warnings = (res.errors || []).filter((e) => e.severity === 'warning' && ours.includes(e.sourceLocation?.file));
  const bytecode = res.contracts?.[`src/${out.file}`]?.[out.contract]?.evm?.bytecode?.object || '';
  const scriptCode = res.contracts?.[`script/${out.scriptFile}`]?.[`Deploy${out.contract}`]?.evm?.bytecode?.object || '';
  const label = `${recipe} ${JSON.stringify(settings)}`;
  if (errors.length || !bytecode || !scriptCode) {
    failed++;
    console.log(`FAIL ${label}`);
    errors.forEach((e) => console.log('  ' + e.formattedMessage.split('\n').slice(0, 4).join('\n  ')));
  } else {
    console.log(`ok   ${label}  (hook ${bytecode.length / 2} bytes, deploy script compiles${warnings.length ? `, ${warnings.length} warning(s)` : ''})`);
    warnings.forEach((w) => console.log('  warn: ' + w.message));
  }
}
console.log(failed ? `\n${failed} failed` : '\nall templates compile');
process.exit(failed ? 1 : 0);
