// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {Launchpad} from "./Launchpad.sol";
import {CurrencyDesk} from "./CurrencyDesk.sol";

interface IERC20Balance {
    function balanceOf(address) external view returns (uint256);
    function allowance(address, address) external view returns (uint256);
}

/// @title Router
/// @notice One entry point to swap anything on the pad for anything else:
/// currency to currency through the desk, currency to coin through the coin's
/// market, and coin to coin by selling into one currency, converting if the two
/// coins are paired with different ones, and buying the other.
/// @dev Holds nothing between transactions. When a buy sells out a curve, the
/// part of the input the market did not need comes back to the caller in the
/// coin's currency.
contract Router {
    using SafeTransferLib for address;

    enum Kind {
        None,
        Currency,
        Coin
    }

    Launchpad public immutable pad;
    CurrencyDesk public immutable desk;

    event Swap(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 refund,
        address recipient
    );

    error Expired();
    error Slippage();
    error UnknownToken(address token);
    error SameToken();
    error ZeroAmount();

    constructor(Launchpad pad_) {
        pad = pad_;
        desk = pad_.desk();
    }

    function kindOf(address token) public view returns (Kind) {
        if (pad.isCoin(token)) return Kind.Coin;
        if (desk.isListed(token)) return Kind.Currency;
        return Kind.None;
    }

    /// @notice Swaps exactly `amountIn` of `tokenIn` for at least `minOut` of `tokenOut`.
    /// @return amountOut What `recipient` received.
    /// @return refund Currency returned to the caller when a curve sold out mid-swap.
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minOut,
        address recipient,
        uint256 deadline
    ) external returns (uint256 amountOut, uint256 refund) {
        if (block.timestamp > deadline) revert Expired();
        if (tokenIn == tokenOut) revert SameToken();
        if (amountIn == 0) revert ZeroAmount();
        Kind kin = kindOf(tokenIn);
        Kind kout = kindOf(tokenOut);
        if (kin == Kind.None) revert UnknownToken(tokenIn);
        if (kout == Kind.None) revert UnknownToken(tokenOut);

        tokenIn.safeTransferFrom(msg.sender, address(this), amountIn);

        if (kin == Kind.Currency && kout == Kind.Currency) {
            amountOut = _convert(tokenIn, tokenOut, amountIn, recipient);
        } else if (kin == Kind.Currency) {
            address cur = pad.currencyOf(tokenOut);
            uint256 spend = tokenIn == cur ? amountIn : _convert(tokenIn, cur, amountIn, address(this));
            (amountOut, refund) = _buy(tokenOut, cur, spend, recipient);
        } else if (kout == Kind.Currency) {
            address cur = pad.currencyOf(tokenIn);
            if (tokenOut == cur) {
                amountOut = _sell(tokenIn, amountIn, recipient);
            } else {
                uint256 got = _sell(tokenIn, amountIn, address(this));
                amountOut = _convert(cur, tokenOut, got, recipient);
            }
        } else {
            address curIn = pad.currencyOf(tokenIn);
            address curOut = pad.currencyOf(tokenOut);
            uint256 got = _sell(tokenIn, amountIn, address(this));
            if (curIn != curOut) got = _convert(curIn, curOut, got, address(this));
            (amountOut, refund) = _buy(tokenOut, curOut, got, recipient);
        }

        if (amountOut < minOut) revert Slippage();
        emit Swap(msg.sender, tokenIn, tokenOut, amountIn, amountOut, refund, recipient);
    }

    /// @notice What `swap` would return right now.
    function quote(address tokenIn, address tokenOut, uint256 amountIn)
        external
        view
        returns (uint256 amountOut, uint256 refund)
    {
        if (tokenIn == tokenOut) revert SameToken();
        Kind kin = kindOf(tokenIn);
        Kind kout = kindOf(tokenOut);
        if (kin == Kind.None) revert UnknownToken(tokenIn);
        if (kout == Kind.None) revert UnknownToken(tokenOut);

        if (kin == Kind.Currency && kout == Kind.Currency) {
            (amountOut,) = desk.quoteConvert(tokenIn, tokenOut, amountIn);
        } else if (kin == Kind.Currency) {
            address cur = pad.currencyOf(tokenOut);
            uint256 spend = amountIn;
            if (tokenIn != cur) (spend,) = desk.quoteConvert(tokenIn, cur, amountIn);
            uint256 used;
            (amountOut, used,,) = pad.quoteBuy(tokenOut, spend);
            refund = spend - used;
        } else if (kout == Kind.Currency) {
            address cur = pad.currencyOf(tokenIn);
            (amountOut,) = pad.quoteSell(tokenIn, amountIn);
            if (tokenOut != cur) (amountOut,) = desk.quoteConvert(cur, tokenOut, amountOut);
        } else {
            address curIn = pad.currencyOf(tokenIn);
            address curOut = pad.currencyOf(tokenOut);
            (uint256 got,) = pad.quoteSell(tokenIn, amountIn);
            if (curIn != curOut) (got,) = desk.quoteConvert(curIn, curOut, got);
            uint256 used;
            (amountOut, used,,) = pad.quoteBuy(tokenOut, got);
            refund = got - used;
        }
    }

    /// @notice Balances of many tokens in one call.
    function balancesOf(address account, address[] calldata tokens) external view returns (uint256[] memory out) {
        out = new uint256[](tokens.length);
        for (uint256 i; i < tokens.length; ++i) {
            out[i] = IERC20Balance(tokens[i]).balanceOf(account);
        }
    }

    /// @notice Allowances of many tokens to one spender in one call.
    function allowancesOf(address account, address spender, address[] calldata tokens)
        external
        view
        returns (uint256[] memory out)
    {
        out = new uint256[](tokens.length);
        for (uint256 i; i < tokens.length; ++i) {
            out[i] = IERC20Balance(tokens[i]).allowance(account, spender);
        }
    }

    function _convert(address from, address to, uint256 amount, address recipient) internal returns (uint256) {
        from.safeApprove(address(desk), amount);
        return desk.convert(from, to, amount, 0, recipient);
    }

    function _buy(address coin, address cur, uint256 spend, address recipient)
        internal
        returns (uint256 got, uint256 refund)
    {
        cur.safeApprove(address(pad), spend);
        uint256 used;
        (got, used) = pad.buy(coin, spend, 0, recipient);
        if (used < spend) {
            refund = spend - used;
            cur.safeApprove(address(pad), 0);
            cur.safeTransfer(msg.sender, refund);
        }
    }

    function _sell(address coin, uint256 amount, address recipient) internal returns (uint256) {
        coin.safeApprove(address(pad), amount);
        return pad.sellFor(msg.sender, coin, amount, 0, recipient);
    }
}
