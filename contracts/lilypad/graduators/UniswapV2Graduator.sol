// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SafeTransfer} from "../lib/SafeTransfer.sol";
import {IGraduator} from "../interfaces/IGraduator.sol";

interface IUniswapV2Router02 {
    function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline)
        external returns (uint256 amountA, uint256 amountB, uint256 liquidity);
}

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

/// @title UniswapV2Graduator
/// @notice Seeds a Uniswap-V2-style pool with the curve's coins and stock and sends the LP
///         tokens to the dead address, so the liquidity can never be pulled. Works with any
///         V2 fork (router + factory). A Uniswap v4 graduator can implement the same interface.
contract UniswapV2Graduator is IGraduator {
    using SafeTransfer for address;

    address private constant DEAD = 0x000000000000000000000000000000000000dEaD;
    IUniswapV2Router02 public immutable router;
    IUniswapV2Factory public immutable factoryV2;

    event PoolSeeded(address indexed pool, address indexed token, address indexed quote, uint256 tokenAmount, uint256 quoteAmount, uint256 liquidity);

    error NoPool();

    constructor(address router_, address factoryV2_) {
        router = IUniswapV2Router02(router_);
        factoryV2 = IUniswapV2Factory(factoryV2_);
    }

    function graduate(address token, address quote, uint256 tokenAmount, uint256 quoteAmount) external returns (address pool) {
        token.safeTransferFrom(msg.sender, address(this), tokenAmount);
        quote.safeTransferFrom(msg.sender, address(this), quoteAmount);
        token.safeApprove(address(router), tokenAmount);
        quote.safeApprove(address(router), quoteAmount);
        (uint256 usedToken, uint256 usedQuote, uint256 liquidity) = router.addLiquidity(token, quote, tokenAmount, quoteAmount, 0, 0, DEAD, block.timestamp);
        token.safeApprove(address(router), 0);
        quote.safeApprove(address(router), 0);
        pool = factoryV2.getPair(token, quote);
        if (pool == address(0)) revert NoPool();
        // a pre-existing pool with a different price can leave change; it goes back to the curve
        if (tokenAmount > usedToken) token.safeTransfer(msg.sender, tokenAmount - usedToken);
        if (quoteAmount > usedQuote) quote.safeTransfer(msg.sender, quoteAmount - usedQuote);
        emit PoolSeeded(pool, token, quote, usedToken, usedQuote, liquidity);
    }
}
