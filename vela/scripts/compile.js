/* Compiles contracts/VelaToken.sol into erc20.js. Needs solc: `npm i --no-save solc@0.8.24` first. */
const solc = require('solc'); const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '../contracts/VelaToken.sol'), 'utf8');
const out = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources: { 'VelaToken.sol': { content: src } },
  settings: { evmVersion: 'paris', optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } })));
if (out.errors) out.errors.forEach(e => console.error(e.formattedMessage));
const c = out.contracts['VelaToken.sol'].VelaToken;
const abi = c.abi.filter(x => x.type === 'constructor' || ['balanceOf','decimals','symbol','name','totalSupply'].includes(x.name));
fs.writeFileSync(require('path').join(__dirname, '../erc20.js'),
`/* VelaToken — compiled from contracts/VelaToken.sol with solc ${solc.version()}
   (optimizer on, 200 runs, evmVersion paris so it deploys on every EVM chain Vela supports).
   Regenerate with: npm i --no-save solc@0.8.24 && node scripts/compile.js */
window.VELA_ERC20 = {
  abi: ${JSON.stringify(abi)},
  bytecode: '0x${c.evm.bytecode.object}'
};
`);
console.log('bytecode bytes', c.evm.bytecode.object.length / 2);
