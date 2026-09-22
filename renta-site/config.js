/* ===========================================================================
   RENTA — deployment configuration. The only file to edit when the vault
   goes live. Everything here is read by wallet.js at page load.
   =========================================================================== */
window.RENTA_CONFIG = {
  /* the chain the vault lives on: Base mainnet by default */
  chain: {
    id: 8453,
    hex: '0x2105',
    name: 'Base',
    rpc: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
    currency: { name: 'Ether', symbol: 'ETH', decimals: 18 }
  },
  /* contract addresses — null until deployed. With these null the page
     connects wallets but reads nothing, and says so. */
  vault: null,         /* the Vault (vRENTA), ERC-4626 */
  asset: null,         /* the EURG stablecoin the vault takes */
  registry: null,      /* the RollRegistry the vault writes to */
  /* identity check — the provider's hosted flow, or null */
  kycUrl: null,
  /* who the offer is open to */
  eligible: ['EU/EEA', 'Switzerland', 'United Kingdom'],
  notOffered: ['United States', 'Canada', 'Japan', 'any country under EU sanctions']
};
