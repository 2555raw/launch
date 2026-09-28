// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

// Pulls the real Uniswap v4 PoolManager and a mintable ERC20 into the build so the
// end-to-end test can run against them on a local EVM.
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {TestERC20} from "@uniswap/v4-core/src/test/TestERC20.sol";
