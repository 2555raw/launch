/* Compiles Uniswap's TickMath with Uniswap's compiler, so the 0.8 port can be
   held against it directly. This is the test that actually proves a port:
   matching an independent value proves the maths, matching the original
   proves the transcription. */
import solc076 from 'solc076';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const require_ = createRequire(import.meta.url);
const FILES = { TickMathOriginal: 'TickMathOriginal.sol', LiquidityOriginal: 'LiquidityOriginal.sol' };

const input = {
  language: 'Solidity',
  sources: Object.fromEntries(Object.entries(FILES).map(([, f]) =>
    [`test/original/${f}`, { content: readFileSync(resolve(HERE, f), 'utf8') }])),
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
};

const out = JSON.parse(solc076.compile(JSON.stringify(input), {
  import: p => {
    try { return { contents: readFileSync(require_.resolve(p), 'utf8') }; }
    catch (e) { return { error: 'not found: ' + p }; }
  },
}));

const errors = (out.errors || []).filter(e => e.severity === 'error');
if (errors.length) { errors.forEach(e => console.error(e.formattedMessage)); throw new Error('0.7.6 compile failed'); }

export const originals = {};
for (const [name, file] of Object.entries(FILES)) {
  const c = out.contracts[`test/original/${file}`][name];
  originals[name] = { abi: c.abi, bytecode: '0x' + c.evm.bytecode.object };
}
export const originalArtifact = originals.TickMathOriginal;
export const originalCompiler = solc076.version();
