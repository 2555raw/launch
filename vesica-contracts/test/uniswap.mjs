/* Uniswap V3 core, as Uniswap ships it.

   The npm package carries the canonical compiled artifacts, so the strategy
   tests run against the real factory and the real pool — the same bytecode
   that is on mainnet — rather than against a mock of them. Nothing here is
   recompiled, which is the point: a mock of a pool would only ever prove the
   strategy agrees with my idea of Uniswap. */

import { createRequire } from 'node:module';
const require_ = createRequire(import.meta.url);

const load = (file, name) => {
  const a = require_(`@uniswap/v3-core/artifacts/contracts/${file}/${name}.json`);
  return { abi: a.abi, bytecode: a.bytecode, deployedSize: a.deployedBytecode.length / 2 - 1 };
};

export const uniswapArtifacts = {
  UniswapV3Factory: load('UniswapV3Factory.sol', 'UniswapV3Factory'),
  UniswapV3Pool: load('UniswapV3Pool.sol', 'UniswapV3Pool'),
};

export const version = require_('@uniswap/v3-core/package.json').version;

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('@uniswap/v3-core', version);
  for (const [n, a] of Object.entries(uniswapArtifacts)) {
    console.log(`  ${n.padEnd(20)} ${String(a.deployedSize).padStart(6)} bytes deployed`);
  }
}
