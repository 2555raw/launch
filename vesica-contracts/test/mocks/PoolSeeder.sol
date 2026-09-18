// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IUniswapV3PoolMin} from "../../src/interfaces/IUniswapV3PoolMin.sol";

/// @dev Stands in for the rest of the market: seeds the pool with liquidity so
///      there is something to trade against, and can shove the price around on
///      demand so the manipulation tests have an attacker. Test only.
contract PoolSeeder {
    IUniswapV3PoolMin public immutable pool;

    constructor(IUniswapV3PoolMin _pool) {
        pool = _pool;
    }

    function seed(int24 lower, int24 upper, uint128 liquidity) external {
        pool.mint(address(this), lower, upper, liquidity, "");
    }

    /// @notice Trade until the pool's price reaches `sqrtPriceLimitX96`.
    function shove(bool zeroForOne, int256 amount, uint160 sqrtPriceLimitX96)
        external
        returns (int256 a0, int256 a1)
    {
        (a0, a1) = pool.swap(address(this), zeroForOne, amount, sqrtPriceLimitX96, "");
    }

    function uniswapV3MintCallback(uint256 a0, uint256 a1, bytes calldata) external {
        if (a0 != 0) IERC20(pool.token0()).transfer(msg.sender, a0);
        if (a1 != 0) IERC20(pool.token1()).transfer(msg.sender, a1);
    }

    function uniswapV3SwapCallback(int256 d0, int256 d1, bytes calldata) external {
        if (d0 > 0) IERC20(pool.token0()).transfer(msg.sender, uint256(d0));
        if (d1 > 0) IERC20(pool.token1()).transfer(msg.sender, uint256(d1));
    }
}
