# Uniswap V2 (for test networks and tests)

`UniswapV2Factory.json` and `UniswapV2Pair.json` are the ABIs and creation bytecode
published in the `@uniswap/v2-core@1.0.1` npm package, unchanged (built from
https://github.com/Uniswap/v2-core, licensed GPL-3.0-or-later). The pad graduates
coins into Uniswap V2 pools. On Robinhood Chain mainnet it uses Uniswap's own
deployment (factory `0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f`); this copy is
only deployed where Uniswap has none: the Foundry tests, a local chain and the
Robinhood Chain testnet.
