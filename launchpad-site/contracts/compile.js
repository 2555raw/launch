/* Compiles contracts/BentoLaunch.sol with the bundled solc and writes the ABI
   and bytecode of each contract to contracts/build/<Name>.json. */
'use strict';
const solc = require('solc');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'BentoLaunch.sol'), 'utf8');
const input = { language: 'Solidity', sources: { 'BentoLaunch.sol': { content: src } },
  settings: { viaIR: true, optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } };
const out = JSON.parse(solc.compile(JSON.stringify(input)));
for (const e of out.errors || []) console.log(e.severity + ': ' + e.formattedMessage);
if ((out.errors || []).some((e) => e.severity === 'error')) process.exit(1);
fs.mkdirSync(path.join(__dirname, 'build'), { recursive: true });
for (const [name, c] of Object.entries(out.contracts['BentoLaunch.sol'])) {
  fs.writeFileSync(path.join(__dirname, 'build', name + '.json'), JSON.stringify({ abi: c.abi, bytecode: '0x' + c.evm.bytecode.object }, null, 1));
  console.log(name, 'ok');
}
