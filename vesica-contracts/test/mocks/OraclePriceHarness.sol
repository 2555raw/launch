// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {OraclePrice} from "../../src/libraries/OraclePrice.sol";

/// @dev Test only.
contract OraclePriceHarness {
    function toSqrtPriceX96(uint256 p, uint8 pd, uint8 ud, uint8 sd, bool u0) external pure returns (uint160) {
        return OraclePrice.toSqrtPriceX96(p, pd, ud, sd, u0);
    }
}
