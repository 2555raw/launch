# Smart contracts

## Solana
No custom program is required: launches use the SPL **Token-2022** program with the metadata-pointer and token-metadata extensions, deployed and audited on every cluster. An optional Anchor registry program lives in `programs/launchpad` (source only, not deployed; see its README).

## Robinhood Chain (EVM)
`packages/evm/contracts/LaunchToken.sol` — a minimal dependency-free ERC-20:
* constructor mints the full supply to the creator, optional `fixedSupply` disables minting forever;
* `transfer/approve/transferFrom/burn`, owner-only `mint` (unless disabled), `disableMinting`, `transferOwnership`;
* compiled with solc-js 0.8.37 (optimizer 200 runs, evm `paris`) by `npm run compile:evm` into `packages/evm/src/artifacts/LaunchToken.json` (ABI + bytecode + metadata + source), which both the API (`/launchpad/config`) and the verifier use.

Deployment is a contract-creation transaction sent by the user's wallet (`walletClient.deployContract`). The verifier reads the receipt, requires `contractAddress`, checks code exists and reads `name/symbol/decimals/totalSupply/owner/mintingDisabled` from the chain.

Networks: mainnet chain id 4663 (`https://rpc.mainnet.chain.robinhood.com`, explorer `robinhoodchain.blockscout.com`), testnet chain id 46630 (`https://rpc.testnet.chain.robinhood.com`, explorer `explorer.testnet.chain.robinhood.com`). Both verified live while building this.
