// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {LiquidityAmounts} from "@uniswap/v4-periphery/src/libraries/LiquidityAmounts.sol";

import {NebariToken} from "./NebariToken.sol";

/// @title NebariFactory
/// @notice One transaction creates a token, its Uniswap v4 pool and its liquidity, and
///         locks that liquidity here forever: this contract owns the position and has
///         no function that removes it. The whole supply sits in a single-sided range
///         that starts at the launch price, so the price can never trade below it.
///
///         Fees are the only thing that ever leaves the pool. Anyone can call
///         {collectFees}: fees earned in the paired asset are split between the
///         token's holders, its creator and the protocol treasury; fees earned in the
///         token itself are burned, so every sale prunes the supply.
contract NebariFactory is IUnlockCallback, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;

    uint24 public constant LP_FEE = 10_000; // 1% swap fee
    int24 public constant TICK_SPACING = 200;
    uint256 public constant HOLDER_BPS = 5_000; // half of every fee to holders

    IPoolManager public immutable poolManager;
    address public immutable treasury;
    /// @notice Protocol share of every fee, in basis points. The creator gets the rest.
    uint256 public immutable protocolBps;

    struct Launch {
        address token;
        address creator;
        Currency pair;
        PoolKey key;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint64 createdAt;
        uint160 startSqrtPriceX96;
    }

    address[] private _tokens;
    mapping(address => Launch) private _launches;

    event Launched(
        address indexed token,
        address indexed creator,
        Currency indexed pair,
        PoolId poolId,
        string name,
        string symbol,
        string metadataURI,
        uint160 sqrtPriceX96
    );
    event FeesCollected(
        address indexed token,
        uint256 pairAmount,
        uint256 toHolders,
        uint256 toCreator,
        uint256 toProtocol,
        uint256 burned
    );

    error NotPoolManager();
    error UnknownToken();
    error PairIsToken();
    error BadPrice();
    error EthTransferFailed();
    error BadProtocolBps();

    enum Action {
        LAUNCH,
        COLLECT
    }

    constructor(IPoolManager poolManager_, address treasury_, uint256 protocolBps_) {
        if (protocolBps_ + HOLDER_BPS > 10_000) revert BadProtocolBps();
        poolManager = poolManager_;
        treasury = treasury_;
        protocolBps = protocolBps_;
    }

    // ---------------------------------------------------------------- views

    function tokenCount() external view returns (uint256) {
        return _tokens.length;
    }

    function tokenAt(uint256 i) external view returns (address) {
        return _tokens[i];
    }

    function getLaunch(address token) external view returns (Launch memory) {
        Launch memory l = _launches[token];
        if (l.token == address(0)) revert UnknownToken();
        return l;
    }

    /// @notice Launches `count` entries starting at `start`, newest last.
    function getLaunches(uint256 start, uint256 count) external view returns (Launch[] memory out) {
        uint256 n = _tokens.length;
        if (start >= n) return out;
        uint256 end = start + count;
        if (end > n) end = n;
        out = new Launch[](end - start);
        for (uint256 i = start; i < end; i++) {
            out[i - start] = _launches[_tokens[i]];
        }
    }

    // --------------------------------------------------------------- launch

    /// @notice Create a token that trades against `pair` from `startPrice` up.
    /// @param pair       The asset to trade against. Currency.wrap(address(0)) is native ETH.
    /// @param startPrice Raw units of `pair` per one whole token (1e18 base units).
    ///                   Example: 0.000001 USDG per token with 6 decimals -> 1.
    function launch(
        string calldata name,
        string calldata symbol,
        string calldata metadataURI,
        Currency pair,
        uint256 startPrice
    ) external nonReentrant returns (address tokenAddr) {
        if (startPrice == 0) revert BadPrice();

        NebariToken token = new NebariToken(
            name, symbol, metadataURI, address(poolManager), Currency.unwrap(pair), msg.sender
        );
        tokenAddr = address(token);
        if (tokenAddr == Currency.unwrap(pair)) revert PairIsToken();

        Currency tokenCurrency = Currency.wrap(tokenAddr);
        bool tokenIsZero = tokenCurrency < pair;

        // pool price is currency1 per currency0, in raw units, as a Q64.96 square root
        uint256 ratioX192 = tokenIsZero
            ? FullMath.mulDiv(startPrice, 2 ** 192, 1e18)
            : FullMath.mulDiv(1e18, 2 ** 192, startPrice);
        uint256 sqrtRatio = Math.sqrt(ratioX192);
        if (sqrtRatio <= TickMath.MIN_SQRT_PRICE || sqrtRatio >= TickMath.MAX_SQRT_PRICE) revert BadPrice();
        int24 startTick = TickMath.getTickAtSqrtPrice(uint160(sqrtRatio));

        // the position sits entirely on the token's side of the price: above it when the
        // token is currency0, below it when it is currency1. The pool is initialised on
        // the boundary tick so the price floor is exact.
        int24 tickLower;
        int24 tickUpper;
        int24 boundary;
        if (tokenIsZero) {
            boundary = _ceilToSpacing(startTick);
            tickLower = boundary;
            tickUpper = TickMath.maxUsableTick(TICK_SPACING);
        } else {
            boundary = _floorToSpacing(startTick);
            tickLower = TickMath.minUsableTick(TICK_SPACING);
            tickUpper = boundary;
        }
        if (tickLower >= tickUpper) revert BadPrice();
        uint160 sqrtPriceX96 = TickMath.getSqrtPriceAtTick(boundary);

        PoolKey memory key = PoolKey({
            currency0: tokenIsZero ? tokenCurrency : pair,
            currency1: tokenIsZero ? pair : tokenCurrency,
            fee: LP_FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(0))
        });

        // keep a sliver back so liquidity rounding can never ask for more than we hold
        uint256 amount = token.balanceOf(address(this)) - 1e9;
        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(tickUpper);
        uint128 liquidity = tokenIsZero
            ? LiquidityAmounts.getLiquidityForAmount0(sqrtLower, sqrtUpper, amount)
            : LiquidityAmounts.getLiquidityForAmount1(sqrtLower, sqrtUpper, amount);

        Launch memory l = Launch({
            token: tokenAddr,
            creator: msg.sender,
            pair: pair,
            key: key,
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidity: liquidity,
            createdAt: uint64(block.timestamp),
            startSqrtPriceX96: sqrtPriceX96
        });
        _launches[tokenAddr] = l;
        _tokens.push(tokenAddr);

        poolManager.initialize(key, sqrtPriceX96);
        poolManager.unlock(abi.encode(Action.LAUNCH, tokenAddr));

        emit Launched(tokenAddr, msg.sender, pair, key.toId(), name, symbol, metadataURI, sqrtPriceX96);
    }

    // ----------------------------------------------------------------- fees

    /// @notice Pull the fees a pool has earned and hand them out. Anyone may call it.
    function collectFees(address token) external nonReentrant {
        Launch memory l = _launches[token];
        if (l.token == address(0)) revert UnknownToken();

        bytes memory result = poolManager.unlock(abi.encode(Action.COLLECT, token));
        (uint256 pairAmount, uint256 tokenAmount) = abi.decode(result, (uint256, uint256));

        NebariToken t = NebariToken(payable(token));
        // the token's own fees are pruned from the supply
        if (tokenAmount > 0) t.burn(tokenAmount);

        uint256 toProtocol = (pairAmount * protocolBps) / 10_000;
        uint256 toHolders = (pairAmount * HOLDER_BPS) / 10_000;
        uint256 toCreator = pairAmount - toProtocol - toHolders;

        if (toHolders > 0 && t.circulatingSupply() == 0) {
            // nobody holds the token yet; the creator takes the holders' half
            toCreator += toHolders;
            toHolders = 0;
        }

        if (l.pair.isAddressZero()) {
            if (toHolders > 0) t.distribute{value: toHolders}(toHolders);
            if (toCreator > 0) _sendEth(l.creator, toCreator);
            if (toProtocol > 0) _sendEth(treasury, toProtocol);
        } else {
            IERC20 pair = IERC20(Currency.unwrap(l.pair));
            if (toHolders > 0) {
                pair.safeTransfer(token, toHolders);
                t.distribute(toHolders);
            }
            if (toCreator > 0) pair.safeTransfer(l.creator, toCreator);
            if (toProtocol > 0) pair.safeTransfer(treasury, toProtocol);
        }

        emit FeesCollected(token, pairAmount, toHolders, toCreator, toProtocol, tokenAmount);
    }

    // ------------------------------------------------------------- callback

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        (Action action, address token) = abi.decode(data, (Action, address));
        Launch memory l = _launches[token];
        Currency tokenCurrency = Currency.wrap(token);
        bool tokenIsZero = tokenCurrency == l.key.currency0;

        if (action == Action.LAUNCH) {
            (BalanceDelta delta,) = poolManager.modifyLiquidity(
                l.key,
                ModifyLiquidityParams({
                    tickLower: l.tickLower,
                    tickUpper: l.tickUpper,
                    liquidityDelta: int256(uint256(l.liquidity)),
                    salt: bytes32(0)
                }),
                ""
            );
            int128 owedToken = tokenIsZero ? delta.amount0() : delta.amount1();
            int128 owedPair = tokenIsZero ? delta.amount1() : delta.amount0();
            // single-sided by construction: the pair side must be untouched
            if (owedPair != 0) revert BadPrice();
            uint256 amount = uint256(uint128(-owedToken));
            poolManager.sync(tokenCurrency);
            IERC20(token).safeTransfer(address(poolManager), amount);
            poolManager.settle();
            return "";
        }

        // COLLECT: a zero-liquidity modify returns the fees accrued to the position
        (, BalanceDelta fees) = poolManager.modifyLiquidity(
            l.key,
            ModifyLiquidityParams({tickLower: l.tickLower, tickUpper: l.tickUpper, liquidityDelta: 0, salt: bytes32(0)}),
            ""
        );
        uint256 pairAmount = _takePositive(l.key, tokenIsZero ? fees.amount1() : fees.amount0(), !tokenIsZero);
        uint256 tokenAmount = _takePositive(l.key, tokenIsZero ? fees.amount0() : fees.amount1(), tokenIsZero);
        return abi.encode(pairAmount, tokenAmount);
    }

    function _takePositive(PoolKey memory key, int128 amount, bool isZero) private returns (uint256 taken) {
        if (amount <= 0) return 0;
        taken = uint256(uint128(amount));
        poolManager.take(isZero ? key.currency0 : key.currency1, address(this), taken);
    }

    function _sendEth(address to, uint256 amount) private {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert EthTransferFailed();
    }

    function _floorToSpacing(int24 tick) private pure returns (int24) {
        int24 q = tick / TICK_SPACING;
        if (tick < 0 && tick % TICK_SPACING != 0) q -= 1;
        return q * TICK_SPACING;
    }

    function _ceilToSpacing(int24 tick) private pure returns (int24) {
        int24 f = _floorToSpacing(tick);
        return f == tick ? f : f + TICK_SPACING;
    }

    receive() external payable {}
}
