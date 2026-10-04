// Only used to give the hook tests an in-process chain. Nothing is compiled by
// Hardhat itself: test.js compiles with solc 0.8.26 and deploys the bytecode.
module.exports = {
  networks: {
    hardhat: { hardfork: 'cancun', allowUnlimitedContractSize: true, initialBaseFeePerGas: 0 }
  }
};
