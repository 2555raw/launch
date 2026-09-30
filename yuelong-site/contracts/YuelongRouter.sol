// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SafeTransfer} from "./lib/SafeTransfer.sol";
import {IWrappedNative} from "./interfaces/IWrappedNative.sol";

interface ICurve {
    function quote() external view returns (address);
    function token() external view returns (address);
    function graduated() external view returns (bool);
    function pool() external view returns (address);
    function quoteBuy(uint256 quoteIn, address buyer) external view returns (uint256 tokensOut, uint256 fee, uint256 creatorFee, uint256 snipeTax);
    function quoteSell(uint256 tokensIn) external view returns (uint256 quoteOut, uint256 fee, uint256 creatorFee);
    function tokenReserve() external view returns (uint256);
    function buy(uint256 quoteIn, uint256 minTokensOut, address recipient) external returns (uint256);
    function sell(uint256 tokensIn, uint256 minQuoteOut, address recipient) external returns (uint256);
}

interface IPool {
    function getAmountOut(address tokenIn, uint256 amountIn) external view returns (uint256);
    function swap(address tokenIn, uint256 amountIn, uint256 minOut, address recipient) external returns (uint256);
}

/// @title YuelongRouter
/// @notice One place to trade any Yuelong coin, before or after it graduates, and in the
///         native coin when the pair is WTAO: `buy` wraps what you send, `sell` can unwrap what
///         you get. Holds nothing between calls. Approve the coin (or an ERC20 quote) to it.
contract YuelongRouter {
    using SafeTransfer for address;

    address public immutable wnative;

    event Trade(address indexed trader, address indexed curve, bool buy, uint256 quoteAmount, uint256 tokenAmount, bool graduated);

    error NotNative();
    error WrongValue();
    error SendFailed();
    error Refused();

    constructor(address wnative_) { wnative = wnative_; }

    /// @dev Only the wrapped coin sends native coin here, when it unwraps a sale.
    receive() external payable { if (msg.sender != wnative) revert Refused(); }

    // ------------------------------------------------------------------ quotes

    /// @notice Coins `quoteIn` buys right now, through the curve or, once graduated, the pool.
    function quoteBuy(address curve, uint256 quoteIn) external view returns (uint256 tokensOut) {
        ICurve c = ICurve(curve);
        if (c.graduated()) return IPool(c.pool()).getAmountOut(c.quote(), quoteIn);
        (tokensOut, , , ) = c.quoteBuy(quoteIn, address(this));
    }

    /// @notice Quote asset `tokensIn` coins sell for right now.
    function quoteSell(address curve, uint256 tokensIn) external view returns (uint256 quoteOut) {
        ICurve c = ICurve(curve);
        if (c.graduated()) return IPool(c.pool()).getAmountOut(c.token(), tokensIn);
        (quoteOut, , ) = c.quoteSell(tokensIn);
    }

    // ------------------------------------------------------------------ trading

    /// @notice Buy coins. For a WTAO pair send `quoteIn` as msg.value; otherwise approve the
    ///         quote asset to this router and send nothing.
    function buy(address curve, uint256 quoteIn, uint256 minTokensOut, address recipient) external payable returns (uint256 tokensOut) {
        ICurve c = ICurve(curve);
        address q = c.quote();
        if (msg.value > 0) {
            if (q != wnative) revert NotNative();
            if (msg.value != quoteIn) revert WrongValue();
            IWrappedNative(wnative).deposit{value: msg.value}();
        } else {
            q.safeTransferFrom(msg.sender, address(this), quoteIn);
        }
        bool grad = c.graduated();
        address venue = grad ? c.pool() : curve;
        q.safeApprove(venue, quoteIn);
        tokensOut = grad ? IPool(venue).swap(q, quoteIn, minTokensOut, recipient) : c.buy(quoteIn, minTokensOut, recipient);
        q.safeApprove(venue, 0);
        emit Trade(msg.sender, curve, true, quoteIn, tokensOut, grad);
    }

    /// @notice Sell coins (approve the coin to this router). With `native` true and a WTAO
    ///         pair, the proceeds arrive as the native coin.
    function sell(address curve, uint256 tokensIn, uint256 minQuoteOut, address recipient, bool native) external returns (uint256 quoteOut) {
        ICurve c = ICurve(curve);
        address q = c.quote();
        address t = c.token();
        if (native && q != wnative) revert NotNative();
        t.safeTransferFrom(msg.sender, address(this), tokensIn);
        bool grad = c.graduated();
        address venue = grad ? c.pool() : curve;
        address to = native ? address(this) : recipient;
        t.safeApprove(venue, tokensIn);
        quoteOut = grad ? IPool(venue).swap(t, tokensIn, minQuoteOut, to) : c.sell(tokensIn, minQuoteOut, to);
        t.safeApprove(venue, 0);
        if (native) {
            IWrappedNative(wnative).withdraw(quoteOut);
            (bool ok, ) = recipient.call{value: quoteOut}("");
            if (!ok) revert SendFailed();
        }
        emit Trade(msg.sender, curve, false, quoteOut, tokensIn, grad);
    }
}
