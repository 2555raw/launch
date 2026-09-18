// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {LiquidityAmounts} from "../../src/libraries/LiquidityAmounts.sol";

/// @dev A door into the internal library for the differential test. Test only.
contract LiquidityHarness {
    function getLiquidityForAmounts(uint160 p, uint160 a, uint160 b, uint256 amt0, uint256 amt1)
        external pure returns (uint128)
    { return LiquidityAmounts.getLiquidityForAmounts(p, a, b, amt0, amt1); }

    function getAmountsForLiquidity(uint160 p, uint160 a, uint160 b, uint128 l)
        external pure returns (uint256, uint256)
    { return LiquidityAmounts.getAmountsForLiquidity(p, a, b, l); }
}
