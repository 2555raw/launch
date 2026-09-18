// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {TickMath} from "../../src/libraries/TickMath.sol";

/// @dev TickMath's functions are internal, so the differential test needs a
///      door into them. Test only.
contract TickMathHarness {
    function getSqrtRatioAtTick(int24 tick) external pure returns (uint160) {
        return TickMath.getSqrtRatioAtTick(tick);
    }

    function getTickAtSqrtRatio(uint160 sqrtPriceX96) external pure returns (int24) {
        return TickMath.getTickAtSqrtRatio(sqrtPriceX96);
    }

    function bounds() external pure returns (int24, int24, uint160, uint160) {
        return (TickMath.MIN_TICK, TickMath.MAX_TICK, TickMath.MIN_SQRT_RATIO, TickMath.MAX_SQRT_RATIO);
    }
}
