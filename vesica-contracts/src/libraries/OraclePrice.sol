// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title OraclePrice
/// @notice Turns a Chainlink price into the sqrt price a Uniswap pool speaks.
///
/// @dev This is the hinge the whole strategy hangs on. Everything the vault
///      decides — what a position is worth, how far a swap may move the pool,
///      where the band sits — is decided from this number and never from the
///      pool's own `slot0`, because `slot0` is whatever the last trade in the
///      same block left behind and a flash loan can leave behind anything.
library OraclePrice {
    error PriceOutOfRange();

    /// @notice The pool's sqrtPriceX96 implied by an oracle quote.
    /// @param priceRaw    The oracle's price of the stock in USDG.
    /// @param priceDec    The decimals that price carries.
    /// @param usdgDec     The decimals of the USDG token.
    /// @param stockDec    The decimals of the stock token.
    /// @param usdgIsToken0 Whether USDG sorts first in the pool.
    ///
    /// @dev A pool price is token1 per token0, in raw units:
    ///
    ///        ratio = 10^dec1 * (quote in the right direction) / 10^dec0
    ///
    ///      and sqrtPriceX96 = sqrt(ratio) * 2^96, which is computed here as
    ///      sqrt(ratio * 2^192) in one step so nothing is truncated to an
    ///      integer in between — the ratio itself is often far below 1.
    function toSqrtPriceX96(
        uint256 priceRaw,
        uint8 priceDec,
        uint8 usdgDec,
        uint8 stockDec,
        bool usdgIsToken0
    ) internal pure returns (uint160) {
        uint256 num;
        uint256 den;
        if (usdgIsToken0) {
            // token0 = USDG, token1 = stock: one raw USDG buys 10^(stockDec)/price raw stock
            num = 10 ** (uint256(stockDec) + uint256(priceDec));
            den = 10 ** uint256(usdgDec) * priceRaw;
        } else {
            // token0 = stock, token1 = USDG: one raw stock is worth price USDG
            num = 10 ** uint256(usdgDec) * priceRaw;
            den = 10 ** (uint256(stockDec) + uint256(priceDec));
        }

        // 2^192, so the square root lands directly in Q64.96
        uint256 inner = Math.mulDiv(num, 1 << 192, den);
        uint256 root = Math.sqrt(inner);
        if (root == 0 || root > type(uint160).max) revert PriceOutOfRange();
        return uint160(root);
    }
}
