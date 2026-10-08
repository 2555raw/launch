# programs/launchpad — optional Anchor program (NOT deployed)

The launchpad does **not** need a custom on-chain program: tokens are created with the audited
SPL Token-2022 program (metadata-pointer + token-metadata extensions), which is live on every
Solana cluster. That is the path the product uses today.

This directory holds an optional Anchor program, `launch_registry`, that records a launch
(creator, mint, metadata URI, timestamp) in a PDA so third parties can verify that a mint was
created through Launch without trusting our database. It is provided as source only:

* it is **not deployed** on any cluster and **nothing in the app depends on it**;
* building it requires the Solana CLI + Anchor toolchain (`solana`, `anchor`, Rust SBF target),
  which are not installed in the environment this repository was built in;
* deploying on mainnet is irreversible and costs SOL, so it must be an explicit decision.

To build and deploy on devnet:

```bash
cd programs/launchpad
anchor build
anchor deploy --provider.cluster devnet
# then set LAUNCH_REGISTRY_PROGRAM_ID in .env and wire `registerLaunch` into
# packages/solana/src/token.ts after the mint instructions.
```
