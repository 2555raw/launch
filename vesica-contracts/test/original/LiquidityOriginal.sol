// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import '@uniswap/v3-periphery/contracts/libraries/LiquidityAmounts.sol';

/// @dev Uniswap's own LiquidityAmounts, their compiler. Test only.
contract LiquidityOriginal {
    function getLiquidityForAmounts(uint160 p, uint160 a, uint160 b, uint256 amt0, uint256 amt1)
        external pure returns (uint128)
    { return LiquidityAmounts.getLiquidityForAmounts(p, a, b, amt0, amt1); }

    function getAmountsForLiquidity(uint160 p, uint160 a, uint160 b, uint128 l)
        external pure returns (uint256, uint256)
    { return LiquidityAmounts.getAmountsForLiquidity(p, a, b, l); }
}
