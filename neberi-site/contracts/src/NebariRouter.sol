// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

/// @title NebariRouter
/// @notice The smallest possible swap router for Nebari pools: exact-input swaps straight
///         against the Uniswap v4 PoolManager, plus a quote that simulates the swap and
///         reverts with the answer (call it with eth_call). It holds nothing between calls.
contract NebariRouter is IUnlockCallback, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using CurrencyLibrary for Currency;

    IPoolManager public immutable poolManager;

    struct SwapData {
        address payer;
        address to;
        PoolKey key;
        bool zeroForOne;
        uint256 amountIn;
        uint256 minOut;
        bool quote;
    }

    event Swapped(address indexed sender, address indexed to, Currency indexed input, uint256 amountIn, uint256 amountOut);

    error NotPoolManager();
    error WrongValue();
    error Slippage(uint256 got, uint256 minOut);
    error QuoteResult(uint256 amountOut);
    error EthTransferFailed();
    error UnexpectedRevert(bytes reason);

    constructor(IPoolManager poolManager_) {
        poolManager = poolManager_;
    }

    /// @notice Swap exactly `amountIn` of the input currency for at least `minOut` of the other.
    ///         Send `amountIn` as value when the input is native ETH; approve this router otherwise.
    function swapExactIn(PoolKey calldata key, bool zeroForOne, uint256 amountIn, uint256 minOut, address to)
        external
        payable
        nonReentrant
        returns (uint256 amountOut)
    {
        Currency input = zeroForOne ? key.currency0 : key.currency1;
        if (input.isAddressZero() ? msg.value != amountIn : msg.value != 0) revert WrongValue();

        bytes memory result = poolManager.unlock(
            abi.encode(SwapData({payer: msg.sender, to: to, key: key, zeroForOne: zeroForOne, amountIn: amountIn, minOut: minOut, quote: false}))
        );
        amountOut = abi.decode(result, (uint256));

        // whatever the pool did not consume comes back
        uint256 left = address(this).balance;
        if (left > 0) {
            (bool ok,) = msg.sender.call{value: left}("");
            if (!ok) revert EthTransferFailed();
        }
        emit Swapped(msg.sender, to, input, amountIn, amountOut);
    }

    /// @notice Simulates {swapExactIn} and returns what it would give. Use with eth_call.
    function quoteExactIn(PoolKey calldata key, bool zeroForOne, uint256 amountIn) external returns (uint256 amountOut) {
        try poolManager.unlock(
            abi.encode(SwapData({payer: msg.sender, to: msg.sender, key: key, zeroForOne: zeroForOne, amountIn: amountIn, minOut: 0, quote: true}))
        ) {} catch (bytes memory reason) {
            if (reason.length == 36 && bytes4(reason) == QuoteResult.selector) {
                assembly ("memory-safe") {
                    amountOut := mload(add(reason, 36))
                }
                return amountOut;
            }
            revert UnexpectedRevert(reason);
        }
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        SwapData memory d = abi.decode(data, (SwapData));

        BalanceDelta delta = poolManager.swap(
            d.key,
            SwapParams({
                zeroForOne: d.zeroForOne,
                amountSpecified: -int256(d.amountIn),
                sqrtPriceLimitX96: d.zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            ""
        );

        int128 inDelta = d.zeroForOne ? delta.amount0() : delta.amount1();
        int128 outDelta = d.zeroForOne ? delta.amount1() : delta.amount0();
        uint256 owed = uint256(uint128(-inDelta));
        uint256 got = uint256(uint128(outDelta));

        if (d.quote) revert QuoteResult(got);
        if (got < d.minOut) revert Slippage(got, d.minOut);

        Currency input = d.zeroForOne ? d.key.currency0 : d.key.currency1;
        Currency output = d.zeroForOne ? d.key.currency1 : d.key.currency0;

        if (input.isAddressZero()) {
            poolManager.settle{value: owed}();
        } else {
            poolManager.sync(input);
            IERC20(Currency.unwrap(input)).safeTransferFrom(d.payer, address(poolManager), owed);
            poolManager.settle();
        }
        poolManager.take(output, d.to, got);
        return abi.encode(got);
    }

    receive() external payable {}
}
