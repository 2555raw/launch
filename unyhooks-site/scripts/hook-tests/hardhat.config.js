// The chain for the hook tests: in-process for test.js, and `npm run node` for
// e2e.js and mainnet-sim.js. It answers as Robinhood Chain (4663) so the builder
// accepts it. Nothing is compiled by Hardhat itself.
module.exports = {
  networks: {
    hardhat: { chainId: 4663, hardfork: 'cancun', allowUnlimitedContractSize: true, initialBaseFeePerGas: 0 }
  }
};
