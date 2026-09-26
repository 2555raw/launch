// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "solady/auth/Ownable.sol";
import {ReentrancyGuard} from "solady/utils/ReentrancyGuard.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";
import {LibClone} from "solady/utils/LibClone.sol";
import {Coin} from "./Coin.sol";
import {CurrencyDesk} from "./CurrencyDesk.sol";

/// @title Launchpad
/// @notice Opens a market for a new coin, paired with one currency from the desk,
/// and runs it: first on a bonding curve, then, once the curve sells out, as a
/// constant-product pool whose liquidity can never be withdrawn.
///
/// @dev Every coin has 1,000,000,000 units. 800M are sold on the curve and 200M
/// wait inside the pad to seed the pool. The curve is x * y = k over virtual
/// reserves; the virtual token reserve is S^2 / (S - L) (S = curve supply,
/// L = pool supply), which is exactly what makes the curve's last price equal the
/// pool's first price, so graduation does not move the price. The virtual quote
/// reserve is fixed per coin at launch, from the desk's USD rate, so every
/// currency's curve raises the same dollar amount when it sells out.
///
/// The currency a coin is paired with is written once, at launch, and there is
/// no function that changes it.
contract Launchpad is Ownable, ReentrancyGuard {
    using SafeTransferLib for address;

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000e18;
    uint256 public constant CURVE_SUPPLY = 800_000_000e18;
    uint256 public constant POOL_SUPPLY = TOTAL_SUPPLY - CURVE_SUPPLY;
    uint256 public constant VIRTUAL_TOKENS = CURVE_SUPPLY * CURVE_SUPPLY / (CURVE_SUPPLY - POOL_SUPPLY);

    uint256 internal constant BPS = 10_000;
    uint256 public constant MAX_TRADE_FEE_BPS = 500;
    uint256 public constant MAX_SNIPE_TAX_BPS = 5_000;
    uint256 public constant MAX_SNIPE_WINDOW = 300;
    uint256 public constant MAX_NAME_BYTES = 40;
    uint256 public constant MAX_SYMBOL_BYTES = 10;
    uint256 public constant MAX_META_BYTES = 16_384;

    /*//////////////////////////////////////////////////////////////
                                 TYPES
    //////////////////////////////////////////////////////////////*/

    struct Market {
        address creator;
        uint64 createdAt;
        bool graduated;
        address currency;
        // The curve's virtual quote reserve, fixed at launch.
        uint256 virtualQuote;
        // Pricing reserves: virtual + real on the curve, real in the pool.
        uint256 reserveToken;
        uint256 reserveQuote;
        // Currency this market actually holds for its buyers: the backing.
        uint256 realQuote;
        // Coins still for sale on the curve; zero once graduated.
        uint256 curveLeft;
        // Cumulative traded currency, gross of fees.
        uint256 volume;
    }

    struct CoinView {
        address coin;
        string name;
        string symbol;
        address creator;
        address currency;
        uint64 createdAt;
        bool graduated;
        uint256 virtualQuote;
        uint256 reserveToken;
        uint256 reserveQuote;
        uint256 realQuote;
        uint256 curveLeft;
        uint256 volume;
    }

    struct BuyQuote {
        uint256 tokensOut;
        uint256 quoteUsed;
        uint256 net;
        uint256 protocolFee;
        uint256 creatorFee;
        uint256 snipeTax;
        bool graduates;
    }

    struct SellQuote {
        uint256 gross;
        uint256 quoteOut;
        uint256 protocolFee;
        uint256 creatorFee;
    }

    /*//////////////////////////////////////////////////////////////
                                 STATE
    //////////////////////////////////////////////////////////////*/

    CurrencyDesk public immutable desk;
    address public immutable coinImplementation;

    address public treasury;
    address public router;
    /// @notice What a full curve raises, in USD with 18 decimals.
    uint256 public targetRaiseUsd;
    uint16 public protocolFeeBps;
    uint16 public creatorFeeBps;
    /// @notice Extra tax on buys at the moment a market opens, decaying linearly to zero.
    uint16 public snipeTaxBps;
    uint32 public snipeWindow;

    mapping(address coin => Market) internal _markets;
    address[] public allCoins;

    /// @notice Sum of realQuote over every market paired with a currency.
    mapping(address currency => uint256) public backing;
    mapping(address currency => uint256) public coinsIn;
    mapping(address account => mapping(address currency => uint256)) public feesOwed;
    mapping(address currency => uint256) public totalFeesOwed;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event CoinCreated(
        address indexed coin,
        address indexed creator,
        address indexed currency,
        string name,
        string symbol,
        string meta,
        uint256 virtualQuote
    );
    event Trade(
        address indexed coin,
        address indexed trader,
        bool isBuy,
        uint256 quoteAmount,
        uint256 tokenAmount,
        uint256 protocolFee,
        uint256 creatorFee,
        uint256 snipeTax,
        uint256 reserveToken,
        uint256 reserveQuote,
        uint256 timestamp
    );
    event Graduated(address indexed coin, uint256 poolTokens, uint256 poolQuote);
    event FeesClaimed(address indexed account, address indexed currency, uint256 amount);
    event FeesSet(uint16 protocolFeeBps, uint16 creatorFeeBps);
    event SnipeSet(uint16 snipeTaxBps, uint32 snipeWindow);
    event TargetRaiseSet(uint256 targetRaiseUsd);
    event TreasurySet(address treasury);
    event RouterSet(address router);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error NotACoin(address coin);
    error CurrencyNotListed(address currency);
    error BadName();
    error BadSymbol();
    error MetaTooLong();
    error Slippage();
    error ZeroAmount();
    error FeeTooHigh();
    error BadSnipe();
    error BadTarget();
    error NotRouter();
    error ZeroAddress();

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        address owner_,
        CurrencyDesk desk_,
        address treasury_,
        uint256 targetRaiseUsd_,
        uint16 protocolFeeBps_,
        uint16 creatorFeeBps_,
        uint16 snipeTaxBps_,
        uint32 snipeWindow_
    ) {
        if (treasury_ == address(0) || address(desk_) == address(0)) revert ZeroAddress();
        if (targetRaiseUsd_ == 0) revert BadTarget();
        if (uint256(protocolFeeBps_) + creatorFeeBps_ > MAX_TRADE_FEE_BPS) revert FeeTooHigh();
        if (snipeTaxBps_ > MAX_SNIPE_TAX_BPS || snipeWindow_ > MAX_SNIPE_WINDOW) revert BadSnipe();
        _initializeOwner(owner_);
        desk = desk_;
        coinImplementation = address(new Coin());
        treasury = treasury_;
        targetRaiseUsd = targetRaiseUsd_;
        protocolFeeBps = protocolFeeBps_;
        creatorFeeBps = creatorFeeBps_;
        snipeTaxBps = snipeTaxBps_;
        snipeWindow = snipeWindow_;
    }

    /*//////////////////////////////////////////////////////////////
                                LAUNCH
    //////////////////////////////////////////////////////////////*/

    /// @notice Launches a coin paired with `currency`, optionally buying some in the same transaction.
    /// @param meta Free-form JSON (description, image, links). Emitted, not stored.
    /// @param firstBuy Currency to spend on the creator's first buy; 0 for none. Not subject to the snipe tax.
    function createCoin(
        string calldata name_,
        string calldata symbol_,
        string calldata meta,
        address currency,
        uint256 firstBuy,
        uint256 minTokensOut
    ) external nonReentrant returns (address coin, uint256 tokensOut) {
        _validateName(name_);
        _validateSymbol(symbol_);
        if (bytes(meta).length > MAX_META_BYTES) revert MetaTooLong();
        coin = _open(name_, symbol_, currency);
        emit CoinCreated(coin, msg.sender, currency, name_, symbol_, meta, _markets[coin].virtualQuote);
        if (firstBuy != 0) tokensOut = _firstBuy(coin, firstBuy, minTokensOut);
    }

    function _open(string calldata name_, string calldata symbol_, address currency) internal returns (address coin) {
        if (!desk.isListed(currency)) revert CurrencyNotListed(currency);
        uint256 vq = virtualQuoteFor(currency);
        if (vq == 0) revert BadTarget();

        coin = LibClone.clone(coinImplementation);
        Coin(coin).initialize(name_, symbol_, TOTAL_SUPPLY);

        Market storage m = _markets[coin];
        m.creator = msg.sender;
        m.createdAt = uint64(block.timestamp);
        m.currency = currency;
        m.virtualQuote = vq;
        m.reserveToken = VIRTUAL_TOKENS;
        m.reserveQuote = vq;
        m.curveLeft = CURVE_SUPPLY;

        allCoins.push(coin);
        ++coinsIn[currency];
    }

    function _firstBuy(address coin, uint256 firstBuy, uint256 minTokensOut) internal returns (uint256) {
        Market storage m = _markets[coin];
        BuyQuote memory q = _quoteBuy(m, firstBuy, true);
        if (q.tokensOut == 0 || q.tokensOut < minTokensOut) revert Slippage();
        m.currency.safeTransferFrom(msg.sender, address(this), q.quoteUsed);
        _applyBuy(coin, m, q, msg.sender, msg.sender);
        return q.tokensOut;
    }

    /*//////////////////////////////////////////////////////////////
                                 TRADE
    //////////////////////////////////////////////////////////////*/

    /// @notice Spends up to `quoteIn` of the coin's currency on the coin.
    /// @dev Only `quoteUsed` is pulled: when a buy sells out the curve it takes
    /// just what the last coin costs and the market graduates.
    function buy(address coin, uint256 quoteIn, uint256 minTokensOut, address recipient)
        external
        nonReentrant
        returns (uint256 tokensOut, uint256 quoteUsed)
    {
        if (quoteIn == 0) revert ZeroAmount();
        Market storage m = _market(coin);
        BuyQuote memory q = _quoteBuy(m, quoteIn, false);
        if (q.tokensOut == 0 || q.tokensOut < minTokensOut) revert Slippage();
        m.currency.safeTransferFrom(msg.sender, address(this), q.quoteUsed);
        _applyBuy(coin, m, q, recipient, recipient);
        return (q.tokensOut, q.quoteUsed);
    }

    /// @notice Sells `tokensIn` of the coin for its currency.
    function sell(address coin, uint256 tokensIn, uint256 minQuoteOut, address recipient)
        external
        nonReentrant
        returns (uint256 quoteOut)
    {
        return _sell(coin, tokensIn, minQuoteOut, recipient, msg.sender);
    }

    /// @notice Router entry point for sells, so the fill is attributed to the person, not the router.
    function sellFor(address trader, address coin, uint256 tokensIn, uint256 minQuoteOut, address recipient)
        external
        nonReentrant
        returns (uint256 quoteOut)
    {
        if (msg.sender != router || router == address(0)) revert NotRouter();
        return _sell(coin, tokensIn, minQuoteOut, recipient, trader);
    }

    /// @notice Pays out the fees `msg.sender` has earned in `currency` (creator fees, or the treasury's share).
    function claimFees(address currency) external nonReentrant returns (uint256 amount) {
        amount = feesOwed[msg.sender][currency];
        if (amount == 0) revert ZeroAmount();
        feesOwed[msg.sender][currency] = 0;
        totalFeesOwed[currency] -= amount;
        currency.safeTransfer(msg.sender, amount);
        emit FeesClaimed(msg.sender, currency, amount);
    }

    /*//////////////////////////////////////////////////////////////
                                INTERNALS
    //////////////////////////////////////////////////////////////*/

    function _sell(address coin, uint256 tokensIn, uint256 minQuoteOut, address recipient, address trader)
        internal
        returns (uint256)
    {
        if (tokensIn == 0) revert ZeroAmount();
        Market storage m = _market(coin);
        SellQuote memory q = _quoteSell(m, tokensIn);
        if (q.quoteOut == 0 || q.quoteOut < minQuoteOut) revert Slippage();

        coin.safeTransferFrom(msg.sender, address(this), tokensIn);

        address currency = m.currency;
        m.reserveToken += tokensIn;
        m.reserveQuote -= q.gross;
        m.realQuote -= q.gross;
        if (!m.graduated) m.curveLeft += tokensIn;
        m.volume += q.gross;
        backing[currency] -= q.gross;
        _accrue(m.creator, currency, q.protocolFee, q.creatorFee, 0);

        currency.safeTransfer(recipient, q.quoteOut);
        emit Trade(
            coin,
            trader,
            false,
            q.quoteOut,
            tokensIn,
            q.protocolFee,
            q.creatorFee,
            0,
            m.reserveToken,
            m.reserveQuote,
            block.timestamp
        );
        return q.quoteOut;
    }

    function _applyBuy(address coin, Market storage m, BuyQuote memory q, address recipient, address trader) internal {
        address currency = m.currency;
        m.reserveToken -= q.tokensOut;
        m.reserveQuote += q.net;
        m.realQuote += q.net;
        if (!m.graduated) m.curveLeft -= q.tokensOut;
        m.volume += q.quoteUsed;
        backing[currency] += q.net;
        _accrue(m.creator, currency, q.protocolFee, q.creatorFee, q.snipeTax);

        coin.safeTransfer(recipient, q.tokensOut);
        emit Trade(
            coin,
            trader,
            true,
            q.quoteUsed,
            q.tokensOut,
            q.protocolFee,
            q.creatorFee,
            q.snipeTax,
            m.reserveToken,
            m.reserveQuote,
            block.timestamp
        );

        if (!m.graduated && m.curveLeft == 0) {
            // The curve sold out: its backing and the 200M held back become a pool.
            m.graduated = true;
            m.reserveToken = POOL_SUPPLY;
            m.reserveQuote = m.realQuote;
            emit Graduated(coin, POOL_SUPPLY, m.realQuote);
        }
    }

    function _accrue(address creator, address currency, uint256 protocolFee, uint256 creatorFee, uint256 snipeTax)
        internal
    {
        uint256 toTreasury = protocolFee + snipeTax;
        if (toTreasury != 0) feesOwed[treasury][currency] += toTreasury;
        if (creatorFee != 0) feesOwed[creator][currency] += creatorFee;
        totalFeesOwed[currency] += toTreasury + creatorFee;
    }

    function _quoteBuy(Market storage m, uint256 quoteIn, bool exempt) internal view returns (BuyQuote memory q) {
        uint256 snipe = exempt ? 0 : _snipeBps(m.createdAt);
        uint256 totalBps = uint256(protocolFeeBps) + creatorFeeBps + snipe;

        q.quoteUsed = quoteIn;
        q.net = quoteIn * (BPS - totalBps) / BPS;
        q.tokensOut = FixedPointMathLib.fullMulDiv(m.reserveToken, q.net, m.reserveQuote + q.net);

        if (!m.graduated && q.tokensOut >= m.curveLeft) {
            // Take exactly what is left and charge only for that.
            q.tokensOut = m.curveLeft;
            q.net = FixedPointMathLib.fullMulDivUp(m.reserveQuote, q.tokensOut, m.reserveToken - q.tokensOut);
            q.quoteUsed = FixedPointMathLib.fullMulDivUp(q.net, BPS, BPS - totalBps);
            if (q.quoteUsed > quoteIn) q.quoteUsed = quoteIn;
            q.graduates = true;
        }

        uint256 fees = q.quoteUsed - q.net;
        if (totalBps != 0 && fees != 0) {
            q.snipeTax = fees * snipe / totalBps;
            q.creatorFee = fees * creatorFeeBps / totalBps;
            q.protocolFee = fees - q.snipeTax - q.creatorFee;
        }
    }

    function _quoteSell(Market storage m, uint256 tokensIn) internal view returns (SellQuote memory q) {
        q.gross = FixedPointMathLib.fullMulDiv(m.reserveQuote, tokensIn, m.reserveToken + tokensIn);
        if (q.gross > m.realQuote) q.gross = m.realQuote;
        uint256 feeBps = uint256(protocolFeeBps) + creatorFeeBps;
        uint256 fees = q.gross * feeBps / BPS;
        if (feeBps != 0) {
            q.creatorFee = fees * creatorFeeBps / feeBps;
            q.protocolFee = fees - q.creatorFee;
        }
        q.quoteOut = q.gross - fees;
    }

    function _snipeBps(uint64 createdAt) internal view returns (uint256) {
        uint256 elapsed = block.timestamp - createdAt;
        uint256 window = snipeWindow;
        if (elapsed >= window) return 0;
        return uint256(snipeTaxBps) * (window - elapsed) / window;
    }

    function _market(address coin) internal view returns (Market storage m) {
        m = _markets[coin];
        if (m.creator == address(0)) revert NotACoin(coin);
    }

    function _validateName(string calldata name_) internal pure {
        uint256 len = bytes(name_).length;
        if (len == 0 || len > MAX_NAME_BYTES) revert BadName();
    }

    /// @dev Tickers are 1-10 characters of A-Z and 0-9, so two coins cannot look alike through invisible characters.
    function _validateSymbol(string calldata symbol_) internal pure {
        bytes calldata raw = bytes(symbol_);
        if (raw.length == 0 || raw.length > MAX_SYMBOL_BYTES) revert BadSymbol();
        for (uint256 i; i < raw.length; ++i) {
            bytes1 ch = raw[i];
            bool ok = (ch >= 0x41 && ch <= 0x5a) || (ch >= 0x30 && ch <= 0x39);
            if (!ok) revert BadSymbol();
        }
    }

    /*//////////////////////////////////////////////////////////////
                                 VIEWS
    //////////////////////////////////////////////////////////////*/

    /// @notice The virtual quote reserve a coin paired with `currency` would get if launched now.
    function virtualQuoteFor(address currency) public view returns (uint256) {
        uint256 raise = desk.fromUsd(currency, targetRaiseUsd);
        return raise * POOL_SUPPLY / (CURVE_SUPPLY - POOL_SUPPLY);
    }

    /// @notice What a full curve raises in `currency` if a coin is launched now.
    function curveRaiseFor(address currency) external view returns (uint256) {
        return virtualQuoteFor(currency) * (CURVE_SUPPLY - POOL_SUPPLY) / POOL_SUPPLY;
    }

    function quoteBuy(address coin, uint256 quoteIn)
        external
        view
        returns (uint256 tokensOut, uint256 quoteUsed, uint256 fees, uint256 snipeTax)
    {
        BuyQuote memory q = _quoteBuy(_market(coin), quoteIn, false);
        return (q.tokensOut, q.quoteUsed, q.protocolFee + q.creatorFee, q.snipeTax);
    }

    function quoteSell(address coin, uint256 tokensIn) external view returns (uint256 quoteOut, uint256 fees) {
        SellQuote memory q = _quoteSell(_market(coin), tokensIn);
        return (q.quoteOut, q.protocolFee + q.creatorFee);
    }

    /// @notice The first buy's output for a coin not launched yet (no snipe tax, current params).
    function quoteLaunchBuy(address currency, uint256 quoteIn) external view returns (uint256 tokensOut) {
        Market memory m;
        m.virtualQuote = virtualQuoteFor(currency);
        m.reserveToken = VIRTUAL_TOKENS;
        m.reserveQuote = m.virtualQuote;
        m.curveLeft = CURVE_SUPPLY;
        uint256 totalBps = uint256(protocolFeeBps) + creatorFeeBps;
        uint256 net = quoteIn * (BPS - totalBps) / BPS;
        tokensOut = FixedPointMathLib.fullMulDiv(m.reserveToken, net, m.reserveQuote + net);
        if (tokensOut > CURVE_SUPPLY) tokensOut = CURVE_SUPPLY;
    }

    function snipeTaxNow(address coin) external view returns (uint256) {
        return _snipeBps(_market(coin).createdAt);
    }

    function isCoin(address coin) external view returns (bool) {
        return _markets[coin].creator != address(0);
    }

    function currencyOf(address coin) external view returns (address) {
        return _market(coin).currency;
    }

    function getMarket(address coin) external view returns (Market memory) {
        return _market(coin);
    }

    function coinsCount() external view returns (uint256) {
        return allCoins.length;
    }

    /// @notice A page of markets with their names and symbols, in launch order.
    function getCoins(uint256 offset, uint256 limit) external view returns (CoinView[] memory page) {
        uint256 total = allCoins.length;
        if (offset >= total) return page;
        uint256 end = offset + limit > total ? total : offset + limit;
        page = new CoinView[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            address coin = allCoins[i];
            Market storage m = _markets[coin];
            page[i - offset] = CoinView({
                coin: coin,
                name: Coin(coin).name(),
                symbol: Coin(coin).symbol(),
                creator: m.creator,
                currency: m.currency,
                createdAt: m.createdAt,
                graduated: m.graduated,
                virtualQuote: m.virtualQuote,
                reserveToken: m.reserveToken,
                reserveQuote: m.reserveQuote,
                realQuote: m.realQuote,
                curveLeft: m.curveLeft,
                volume: m.volume
            });
        }
    }

    /*//////////////////////////////////////////////////////////////
                                 ADMIN
    //////////////////////////////////////////////////////////////*/

    function setFees(uint16 protocolFeeBps_, uint16 creatorFeeBps_) external onlyOwner {
        if (uint256(protocolFeeBps_) + creatorFeeBps_ > MAX_TRADE_FEE_BPS) revert FeeTooHigh();
        protocolFeeBps = protocolFeeBps_;
        creatorFeeBps = creatorFeeBps_;
        emit FeesSet(protocolFeeBps_, creatorFeeBps_);
    }

    function setSnipe(uint16 snipeTaxBps_, uint32 snipeWindow_) external onlyOwner {
        if (snipeTaxBps_ > MAX_SNIPE_TAX_BPS || snipeWindow_ > MAX_SNIPE_WINDOW) revert BadSnipe();
        snipeTaxBps = snipeTaxBps_;
        snipeWindow = snipeWindow_;
        emit SnipeSet(snipeTaxBps_, snipeWindow_);
    }

    function setTargetRaiseUsd(uint256 targetRaiseUsd_) external onlyOwner {
        if (targetRaiseUsd_ == 0) revert BadTarget();
        targetRaiseUsd = targetRaiseUsd_;
        emit TargetRaiseSet(targetRaiseUsd_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    function setRouter(address router_) external onlyOwner {
        router = router_;
        emit RouterSet(router_);
    }
}
