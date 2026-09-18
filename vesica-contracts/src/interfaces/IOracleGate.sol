// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice The check a vault runs before it will accept money or move a position.
/// @dev Kept behind an interface so the feed wiring can be replaced without
///      touching the vault that holds the funds.
interface IOracleGate {
    /// @notice Reverts unless the chain and the price feed are both healthy.
    /// @return price The asset price, with `decimals()` places.
    function check() external view returns (int256 price);

    /// @notice The number of decimal places `check` returns the price in.
    function decimals() external view returns (uint8);
}
