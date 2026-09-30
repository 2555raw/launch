// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SafeTransfer} from "../lib/SafeTransfer.sol";

/// @title YuelongPool
/// @notice Where a coin trades after it graduates. A constant-product pool of the coin and
///         its quote asset with no LP tokens: the liquidity the curve seeds can never be taken
///         out by anyone, and the 0.3% swap fee stays in the pool, so it only ever deepens.
contract YuelongPool {
    using SafeTransfer for address;

    uint256 public constant FEE_BPS = 30;
    uint256 private constant BPS = 10_000;

    address public immutable graduator;
    address public immutable token;
    address public immutable quote;

    uint256 public tokenReserve;
    uint256 public quoteReserve;
    bool public initialized;
    uint256 private _lock = 1;

    event Seeded(uint256 tokenReserve, uint256 quoteReserve);
    event Swap(address indexed sender, address indexed recipient, bool buy, uint256 amountIn, uint256 amountOut, uint256 tokenReserve, uint256 quoteReserve);

    error NotGraduator();
    error AlreadyInitialized();
    error NotInitialized();
    error Reentrancy();
    error BadToken();
    error ZeroAmount();
    error Slippage();

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    constructor(address token_, address quote_) {
        graduator = msg.sender;
        token = token_;
        quote = quote_;
    }

    /// @dev The graduator sends both assets here, then calls this once.
    function initialize() external {
        if (msg.sender != graduator) revert NotGraduator();
        if (initialized) revert AlreadyInitialized();
        initialized = true;
        tokenReserve = token.balanceOf(address(this));
        quoteReserve = quote.balanceOf(address(this));
        if (tokenReserve == 0 || quoteReserve == 0) revert ZeroAmount();
        emit Seeded(tokenReserve, quoteReserve);
    }

    function getReserves() external view returns (uint256, uint256) { return (tokenReserve, quoteReserve); }

    /// @notice Quote per whole coin, scaled by 1e18.
    function price() external view returns (uint256) {
        return tokenReserve == 0 ? 0 : quoteReserve * 1e18 / tokenReserve;
    }

    function getAmountOut(address tokenIn, uint256 amountIn) public view returns (uint256) {
        (uint256 rIn, uint256 rOut) = tokenIn == quote ? (quoteReserve, tokenReserve) : tokenIn == token ? (tokenReserve, quoteReserve) : (0, 0);
        if (rIn == 0) return 0;
        uint256 inAfterFee = amountIn * (BPS - FEE_BPS);
        return inAfterFee * rOut / (rIn * BPS + inAfterFee);
    }

    /// @notice Pay `amountIn` of `tokenIn` (the coin or the quote asset), receive the other.
    ///         Approve `tokenIn` to this pool first.
    function swap(address tokenIn, uint256 amountIn, uint256 minOut, address recipient) external nonReentrant returns (uint256 amountOut) {
        if (!initialized) revert NotInitialized();
        if (tokenIn != token && tokenIn != quote) revert BadToken();
        if (amountIn == 0) revert ZeroAmount();
        bool isBuy = tokenIn == quote;
        address tokenOut = isBuy ? token : quote;

        uint256 before = tokenIn.balanceOf(address(this));
        tokenIn.safeTransferFrom(msg.sender, address(this), amountIn);
        uint256 received = tokenIn.balanceOf(address(this)) - before;

        amountOut = getAmountOut(tokenIn, received);
        if (amountOut == 0 || amountOut < minOut) revert Slippage();
        tokenOut.safeTransfer(recipient, amountOut);

        tokenReserve = token.balanceOf(address(this));
        quoteReserve = quote.balanceOf(address(this));
        emit Swap(msg.sender, recipient, isBuy, received, amountOut, tokenReserve, quoteReserve);
    }
}
