#!/usr/bin/env node
/** Compiles contracts/LaunchToken.sol with solc-js and writes the ABI + bytecode artifact that ships with the package. */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const solc = require('solc');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(path.join(root, 'contracts/LaunchToken.sol'), 'utf8');

const input = {
  language: 'Solidity',
  sources: { 'LaunchToken.sol': { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: 'paris',
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'metadata'] } },
  },
};
const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (output.errors ?? []).filter((e) => e.severity === 'error');
if (errors.length) {
  for (const e of errors) console.error(e.formattedMessage);
  process.exit(1);
}
const contract = output.contracts['LaunchToken.sol'].LaunchToken;
const artifact = {
  contractName: 'LaunchToken',
  compiler: solc.version(),
  evmVersion: 'paris',
  optimizer: { enabled: true, runs: 200 },
  abi: contract.abi,
  bytecode: '0x' + contract.evm.bytecode.object,
  metadata: contract.metadata,
  source,
};
mkdirSync(path.join(root, 'src/artifacts'), { recursive: true });
writeFileSync(path.join(root, 'src/artifacts/LaunchToken.json'), JSON.stringify(artifact, null, 2));
console.log(`✓ compiled LaunchToken with solc ${solc.version()} (${(contract.evm.bytecode.object.length / 2).toLocaleString()} bytes)`);
