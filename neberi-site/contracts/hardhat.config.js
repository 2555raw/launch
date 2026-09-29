// Only the in-process network is used (see test/run.js); nothing is compiled by Hardhat.
module.exports = {
  networks: { hardhat: { hardfork: 'cancun', allowUnlimitedContractSize: true } },
  paths: { sources: './src-not-used-by-hardhat' },
};
