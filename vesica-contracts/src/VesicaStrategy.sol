// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IUniswapV3PoolMin} from "./interfaces/IUniswapV3PoolMin.sol";
import {IOracleGate} from "./interfaces/IOracleGate.sol";
import {TickMath} from "./libraries/TickMath.sol";
import {LiquidityAmounts} from "./libraries/LiquidityAmounts.sol";
import {OraclePrice} from "./libraries/OraclePrice.sol";

/// @title VesicaStrategy
/// @notice The concentrated Uniswap V3 position behind one vault. USDG comes
///         in, half of it becomes the Stock Token, and the pair is put to work
///         in a band around the oracle price.
///
/// @dev **This contract is the dangerous one.** The vault is arithmetic over
///      balances it controls; this one talks to a market that anybody can move
///      inside the same transaction. Three rules follow from that, and the
///      tests are named after them:
///
///      1. **The oracle prices, the pool only executes.** `totalAssets` is
///         computed from the Chainlink quote, never from `slot0`. A pool's spot
///         price is whatever the previous line of the same transaction left
///         behind, and a flash loan can leave behind anything. Vaults that
///         priced themselves off spot are the single most repeated way this
///         kind of contract has been drained: borrow, shove the pool, mint
///         shares against the lie, shove it back, redeem.
///      2. **No swap runs unbounded.** Every swap carries a price limit taken
///         from the oracle, and is checked again afterwards against what the
///         oracle said it should have received. A swap without both is a
///         standing invitation to sandwich every deposit.
///      3. **Rebalancing is permissioned, banded and rate-limited.** It moves
///         the position, so an attacker who could call it at will could walk
///         the vault into a range of their choosing and trade against it.
contract VesicaStrategy is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    uint256 internal constant BPS = 10_000;
    uint256 internal constant WAD = 1e18;

    IUniswapV3PoolMin public immutable pool;
    IERC20 public immutable usdg;
    IERC20 public immutable stock;
    bool public immutable usdgIsToken0;
    uint8 public immutable usdgDecimals;
    uint8 public immutable stockDecimals;
    int24 public immutable tickSpacing;

    /// @notice The vault this strategy belongs to. The only address allowed to
    ///         move money in or out of it.
    address public immutable vault;

    IOracleGate public gate;

    /// @notice Half the width of the position, in ticks, before snapping.
    int24 public halfBand;

    /// @notice How far the oracle may drift from the position's centre before
    ///         a rebalance is allowed, in ticks.
    int24 public driftTolerance;

    /// @notice The least a swap may return, against what the oracle says it
    ///         should, in basis points below.
    uint256 public maxSlippageBps;

    /// @notice The soonest the position may be moved again.
    uint256 public rebalanceCooldown;
    uint256 public lastRebalance;

    int24 public tickLower;
    int24 public tickUpper;

    event Deployed(uint256 usdgIn, uint256 swapped, uint128 liquidity, int24 lower, int24 upper);
    event Withdrawn(uint256 asked, uint256 sent, uint128 liquidityBurned);
    event Rebalanced(int24 oldLower, int24 oldUpper, int24 newLower, int24 newUpper, uint128 liquidity);
    event FeesCollected(uint256 amount0, uint256 amount1);
    event BandSet(int24 halfBand, int24 driftTolerance);
    event SlippageSet(uint256 bps);
    event GateSet(address indexed previous, address indexed current);

    error OnlyVault();
    error OnlyPool();
    error ZeroAddress();
    error BadBand();
    error BadSlippage();
    error SlippageTooHigh(uint256 got, uint256 wanted);
    error PoolDislocated(uint160 poolSqrtPrice, uint160 oracleSqrtPrice);
    error NoPosition();
    error StillInBand(int24 drift, int24 tolerance);
    error CooldownNotOver(uint256 secondsRemaining);

    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    constructor(
        IUniswapV3PoolMin _pool,
        IERC20 _usdg,
        IOracleGate _gate,
        address _vault,
        address _admin,
        int24 _halfBand,
        int24 _driftTolerance,
        uint256 _maxSlippageBps,
        uint256 _rebalanceCooldown
    ) {
        if (address(_pool) == address(0) || address(_usdg) == address(0) || address(_gate) == address(0)
            || _vault == address(0) || _admin == address(0)) revert ZeroAddress();

        pool = _pool;
        usdg = _usdg;
        gate = _gate;
        vault = _vault;

        address t0 = _pool.token0();
        address t1 = _pool.token1();
        if (address(_usdg) != t0 && address(_usdg) != t1) revert ZeroAddress();
        usdgIsToken0 = address(_usdg) == t0;
        stock = IERC20(usdgIsToken0 ? t1 : t0);

        usdgDecimals = IERC20Metadata(address(_usdg)).decimals();
        stockDecimals = IERC20Metadata(address(stock)).decimals();
        tickSpacing = _pool.tickSpacing();

        _setBand(_halfBand, _driftTolerance);
        _setSlippage(_maxSlippageBps);
        rebalanceCooldown = _rebalanceCooldown;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        emit GateSet(address(0), address(_gate));
    }

    /* ------------------------------------------------------------------ */
    /*  what it is worth — priced by the oracle, never by the pool          */
    /* ------------------------------------------------------------------ */

    /// @notice The oracle's price, and the pool price it implies.
    function oracleSqrtPriceX96() public view returns (uint160) {
        int256 price = gate.check();
        return OraclePrice.toSqrtPriceX96(
            uint256(price), gate.decimals(), usdgDecimals, stockDecimals, usdgIsToken0
        );
    }

    /// @notice Everything this strategy holds, valued in USDG.
    /// @dev Deliberately computed at the oracle price rather than at the pool's.
    ///      The position's token split does depend on where the pool actually
    ///      is, but valuing it at a price an attacker chose is how a vault gets
    ///      emptied, so the split is taken as if the pool sat at the oracle.
    ///
    ///      Known gap, and an audit item: fees earned since the last collect are
    ///      not counted, because reading them needs a state-changing poke. That
    ///      understates the vault, which is the safe direction against theft but
    ///      is slightly unfair to existing holders, so the keeper should collect
    ///      often.
    function totalAssets() public view returns (uint256) {
        uint160 sqrtOracle = oracleSqrtPriceX96();
        (uint256 amount0, uint256 amount1) = _positionAmounts(sqrtOracle);

        (, , , uint128 owed0, uint128 owed1) = pool.positions(_positionKey());
        amount0 += owed0;
        amount1 += owed1;

        amount0 += IERC20(usdgIsToken0 ? address(usdg) : address(stock)).balanceOf(address(this));
        amount1 += IERC20(usdgIsToken0 ? address(stock) : address(usdg)).balanceOf(address(this));

        (uint256 usdgAmt, uint256 stockAmt) =
            usdgIsToken0 ? (amount0, amount1) : (amount1, amount0);

        return usdgAmt + _stockToUsdg(stockAmt);
    }

    function _positionAmounts(uint160 sqrtPriceX96) internal view returns (uint256, uint256) {
        if (tickLower == tickUpper) return (0, 0);
        (uint128 liq,,,,) = pool.positions(_positionKey());
        if (liq == 0) return (0, 0);
        return LiquidityAmounts.getAmountsForLiquidity(
            sqrtPriceX96, TickMath.getSqrtRatioAtTick(tickLower), TickMath.getSqrtRatioAtTick(tickUpper), liq
        );
    }

    function _positionKey() internal view returns (bytes32) {
        return keccak256(abi.encodePacked(address(this), tickLower, tickUpper));
    }

    /// @dev Stock valued in USDG at the oracle price, rounding down.
    function _stockToUsdg(uint256 stockAmount) internal view returns (uint256) {
        if (stockAmount == 0) return 0;
        uint256 price = uint256(gate.check());
        uint8 pd = gate.decimals();
        return Math.mulDiv(stockAmount * price, 10 ** usdgDecimals, 10 ** (uint256(stockDecimals) + pd));
    }

    function _usdgToStock(uint256 usdgAmount) internal view returns (uint256) {
        if (usdgAmount == 0) return 0;
        uint256 price = uint256(gate.check());
        uint8 pd = gate.decimals();
        return Math.mulDiv(usdgAmount, 10 ** (uint256(stockDecimals) + pd), price * 10 ** usdgDecimals);
    }

    /* ------------------------------------------------------------------ */
    /*  money in                                                           */
    /* ------------------------------------------------------------------ */

    /// @notice Take USDG from the vault, put half into the Stock Token, and
    ///         add the pair to the position.
    function deposit(uint256 usdgIn) external onlyVault nonReentrant returns (uint128 added) {
        usdg.safeTransferFrom(msg.sender, address(this), usdgIn);

        uint160 sqrtOracle = oracleSqrtPriceX96();
        if (tickLower == tickUpper) _centre(sqrtOracle);

        uint256 half = usdgIn / 2;
        uint256 bought = _swapChecked(usdgIsToken0, int256(half), sqrtOracle);
        emit Deployed(usdgIn, half, added = _mintAll(sqrtOracle), tickLower, tickUpper);
        bought; // the check that it was a fair swap happens inside _swapChecked
    }

    /// @dev Put whatever this contract is holding into the position.
    function _mintAll(uint160 sqrtOracle) internal returns (uint128 added) {
        uint256 bal0 = IERC20(pool.token0()).balanceOf(address(this));
        uint256 bal1 = IERC20(pool.token1()).balanceOf(address(this));
        added = LiquidityAmounts.getLiquidityForAmounts(
            sqrtOracle, TickMath.getSqrtRatioAtTick(tickLower), TickMath.getSqrtRatioAtTick(tickUpper), bal0, bal1
        );
        if (added == 0) return 0;
        pool.mint(address(this), tickLower, tickUpper, added, "");
    }

    /* ------------------------------------------------------------------ */
    /*  money out                                                          */
    /* ------------------------------------------------------------------ */

    /// @notice Pull `usdgWanted` back out and send it to the vault.
    /// @dev Never gated on the oracle beyond the price it needs to size the
    ///      swap: a depositor leaving must not depend on a feed being healthy.
    function withdraw(uint256 usdgWanted) external onlyVault nonReentrant returns (uint256 sent) {
        uint256 total = totalAssets();
        if (total == 0) return 0;

        (uint128 liq,,,,) = pool.positions(_positionKey());
        uint128 burn_ = usdgWanted >= total
            ? liq
            : uint128(Math.mulDiv(liq, usdgWanted, total));

        if (burn_ != 0) {
            pool.burn(tickLower, tickUpper, burn_);
            pool.collect(address(this), tickLower, tickUpper, type(uint128).max, type(uint128).max);
        }

        // turn everything that is not USDG back into USDG
        uint256 stockHeld = stock.balanceOf(address(this));
        if (stockHeld != 0) _swapChecked(!usdgIsToken0, int256(stockHeld), oracleSqrtPriceX96());

        uint256 have = usdg.balanceOf(address(this));
        sent = usdgWanted < have ? usdgWanted : have;
        if (sent != 0) usdg.safeTransfer(vault, sent);
        emit Withdrawn(usdgWanted, sent, burn_);
    }

    /* ------------------------------------------------------------------ */
    /*  the swap, which is never allowed to run free                       */
    /* ------------------------------------------------------------------ */

    /// @dev Two independent guards, because either alone has a hole:
    ///
    ///      The price limit stops the pool being walked past the oracle by more
    ///      than `maxSlippageBps` during the swap — but a swap that hits its
    ///      limit simply stops early, quietly filling less than asked.
    ///
    ///      So afterwards the realised rate is measured against the oracle's.
    ///      That catches the partial fill, and it catches a sandwich that set
    ///      up before the transaction ran.
    function _swapChecked(bool zeroForOne, int256 amountIn, uint160 sqrtOracle)
        internal
        returns (uint256 amountOut)
    {
        if (amountIn == 0) return 0;

        (uint160 current,,,,,,) = pool.slot0();

        // how far past the oracle the pool may be walked by this swap
        uint160 bound = zeroForOne
            ? uint160(uint256(sqrtOracle).mulDiv(BPS - maxSlippageBps, BPS))
            : uint160(uint256(sqrtOracle).mulDiv(BPS + maxSlippageBps, BPS));

        /* Uniswap requires the limit to sit on the side the swap is heading,
           and it will not always: if the pool has already drifted past the
           bound, a limit taken straight from the oracle points backwards and
           the pool reverts with its own opaque error. Clamping it to one tick
           beyond the current price keeps the call valid and turns that case
           into a fill of nothing, which the check below reports in our own
           words. */
        uint160 limit = zeroForOne
            ? (bound < current ? bound : current - 1)
            : (bound > current ? bound : current + 1);
        if (limit <= TickMath.MIN_SQRT_RATIO) limit = TickMath.MIN_SQRT_RATIO + 1;
        if (limit >= TickMath.MAX_SQRT_RATIO) limit = TickMath.MAX_SQRT_RATIO - 1;

        (int256 d0, int256 d1) = pool.swap(address(this), zeroForOne, amountIn, limit, "");
        uint256 spent = uint256(zeroForOne ? d0 : d1);
        amountOut = uint256(-(zeroForOne ? d1 : d0));

        /* A swap that stopped short is a swap that hit its limit, which means
           the pool is further from the oracle than this strategy is willing to
           trade into. Refusing outright is the point: a partial fill leaves the
           position lopsided and would otherwise pass the ratio check below on
           the small amount that did go through. */
        if (spent != uint256(amountIn)) revert PoolDislocated(current, sqrtOracle);

        // what the oracle says that much input should have fetched
        bool soldUsdg = zeroForOne == usdgIsToken0;
        uint256 fair = soldUsdg ? _usdgToStock(spent) : _stockToUsdg(spent);
        uint256 floor_ = fair.mulDiv(BPS - maxSlippageBps, BPS);
        if (amountOut < floor_) revert SlippageTooHigh(amountOut, floor_);
    }

    /* ------------------------------------------------------------------ */
    /*  rebalancing                                                        */
    /* ------------------------------------------------------------------ */

    /// @notice Move the position back around the oracle price.
    /// @dev Permissioned, banded and rate-limited on purpose. A rebalance that
    ///      anyone could call at any moment is a lever: push the pool, call it,
    ///      and the vault re-mints its liquidity exactly where you want to
    ///      trade against it.
    function rebalance() external onlyRole(KEEPER_ROLE) nonReentrant returns (uint128 liquidity) {
        if (tickLower == tickUpper) revert NoPosition();
        if (block.timestamp < lastRebalance + rebalanceCooldown) {
            revert CooldownNotOver(lastRebalance + rebalanceCooldown - block.timestamp);
        }

        uint160 sqrtOracle = oracleSqrtPriceX96();
        int24 oracleTick = TickMath.getTickAtSqrtRatio(sqrtOracle);
        int24 centre = (tickLower + tickUpper) / 2;
        int24 drift = oracleTick > centre ? oracleTick - centre : centre - oracleTick;
        if (drift < driftTolerance) revert StillInBand(drift, driftTolerance);

        (int24 oldLower, int24 oldUpper) = (tickLower, tickUpper);
        (uint128 liq,,,,) = pool.positions(_positionKey());
        if (liq != 0) {
            pool.burn(oldLower, oldUpper, liq);
            pool.collect(address(this), oldLower, oldUpper, type(uint128).max, type(uint128).max);
        }

        _centre(sqrtOracle);
        _rebalanceHoldings(sqrtOracle);
        liquidity = _mintAll(sqrtOracle);
        lastRebalance = block.timestamp;
        emit Rebalanced(oldLower, oldUpper, tickLower, tickUpper, liquidity);
    }

    /// @dev Bring the two balances back to roughly half and half in USDG terms,
    ///      so the new position can use both sides.
    function _rebalanceHoldings(uint160 sqrtOracle) internal {
        uint256 usdgHeld = usdg.balanceOf(address(this));
        uint256 stockInUsdg = _stockToUsdg(stock.balanceOf(address(this)));
        uint256 total = usdgHeld + stockInUsdg;
        if (total == 0) return;
        uint256 target = total / 2;

        if (usdgHeld > target + 1) {
            _swapChecked(usdgIsToken0, int256(usdgHeld - target), sqrtOracle);
        } else if (stockInUsdg > target + 1) {
            uint256 sellUsdgWorth = stockInUsdg - target;
            _swapChecked(!usdgIsToken0, int256(_usdgToStock(sellUsdgWorth)), sqrtOracle);
        }
    }

    /// @dev Snap a band around the oracle tick onto the pool's tick spacing.
    function _centre(uint160 sqrtOracle) internal {
        int24 t = TickMath.getTickAtSqrtRatio(sqrtOracle);
        int24 centre = (t / tickSpacing) * tickSpacing;
        int24 half = (halfBand / tickSpacing) * tickSpacing;
        if (half < tickSpacing) half = tickSpacing;
        tickLower = centre - half;
        tickUpper = centre + half;
    }

    /// @notice Collect the fees the position has earned and hand them to the vault.
    function collectFees() external onlyRole(KEEPER_ROLE) nonReentrant returns (uint256 amount0, uint256 amount1) {
        if (tickLower == tickUpper) revert NoPosition();
        pool.burn(tickLower, tickUpper, 0);   // poke, so the owed amounts update
        (uint128 c0, uint128 c1) = pool.collect(
            address(this), tickLower, tickUpper, type(uint128).max, type(uint128).max
        );
        emit FeesCollected(amount0 = c0, amount1 = c1);
    }

    /* ------------------------------------------------------------------ */
    /*  the pool calling back                                              */
    /* ------------------------------------------------------------------ */

    function uniswapV3MintCallback(uint256 amount0Owed, uint256 amount1Owed, bytes calldata) external {
        if (msg.sender != address(pool)) revert OnlyPool();
        if (amount0Owed != 0) IERC20(pool.token0()).safeTransfer(msg.sender, amount0Owed);
        if (amount1Owed != 0) IERC20(pool.token1()).safeTransfer(msg.sender, amount1Owed);
    }

    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata) external {
        if (msg.sender != address(pool)) revert OnlyPool();
        if (amount0Delta > 0) IERC20(pool.token0()).safeTransfer(msg.sender, uint256(amount0Delta));
        if (amount1Delta > 0) IERC20(pool.token1()).safeTransfer(msg.sender, uint256(amount1Delta));
    }

    /* ------------------------------------------------------------------ */
    /*  administration                                                     */
    /* ------------------------------------------------------------------ */

    function setBand(int24 _halfBand, int24 _driftTolerance) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setBand(_halfBand, _driftTolerance);
    }

    function _setBand(int24 _halfBand, int24 _driftTolerance) internal {
        if (_halfBand <= 0 || _driftTolerance <= 0 || _halfBand > 500_000) revert BadBand();
        halfBand = _halfBand;
        driftTolerance = _driftTolerance;
        emit BandSet(_halfBand, _driftTolerance);
    }

    function setSlippage(uint256 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setSlippage(bps);
    }

    function _setSlippage(uint256 bps) internal {
        // a ceiling on the ceiling: an admin cannot set slippage so wide that
        // the guard stops being a guard
        if (bps == 0 || bps > 500) revert BadSlippage();
        maxSlippageBps = bps;
        emit SlippageSet(bps);
    }

    function setGate(IOracleGate newGate) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (address(newGate) == address(0)) revert ZeroAddress();
        emit GateSet(address(gate), address(newGate));
        gate = newGate;
    }
}
