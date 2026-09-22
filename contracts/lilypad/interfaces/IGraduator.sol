// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Turns a finished curve into a permanent market. The curve approves `tokenAmount`
///         of the coin and `quoteAmount` of the stock to the graduator and calls this; the
///         graduator pulls both, seeds a pool whose liquidity nobody controls, and returns the
///         pool address. Anything it does not use it sends back to the caller.
interface IGraduator {
    function graduate(address token, address quote, uint256 tokenAmount, uint256 quoteAmount) external returns (address pool);
}
