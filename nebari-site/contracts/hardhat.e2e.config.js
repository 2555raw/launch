// Local chain for the browser test: same chain id as Robinhood Chain so the site's
// network checks behave exactly as on mainnet. Not used for deployment.
module.exports = {
  networks: { hardhat: { chainId: 4663, hardfork: 'cancun', allowUnlimitedContractSize: true, mining: { auto: true } } },
  paths: { sources: './src-not-used-by-hardhat' },
};
