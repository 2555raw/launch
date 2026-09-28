// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "solady/auth/Ownable.sol";
import {ReentrancyGuard} from "solady/utils/ReentrancyGuard.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";
import {LibClone} from "solady/utils/LibClone.sol";
import {Coin} from "./Coin.sol";
import {CurrencyDesk} from "./CurrencyDesk.sol";
import {
    INonfungiblePositionManager,
    IUniswapV3Factory,
    IUniswapV3Pool,
    IUniswapV3SwapCallback
} from "./interfaces/IUniswapV3.sol";

/// @title Launchpad
/// @notice Opens a market for a new coin, paired with one currency from the desk,
/// as a Uniswap V3 pool from the first second: the whole supply goes into the pool
/// as one position that only the pad owns and that nothing can ever withdraw, so
/// every DEX screen and trading terminal sees the coin with its liquidity the
/// moment it launches, and anyone can trade it there or through the pad.
///
/// @dev Every coin has 1,000,000,000 units, all of them put in the pool in one
/// range that starts at the launch price and runs to the top of the price scale.
/// Within that range the pool is a constant-product curve on virtual reserves,
/// exactly like a bonding curve: the pad quotes it as such. The pool's 1% fee is
/// the only fee; it accrues to the pad's position and, when collected, goes half
/// to the coin's creator and half to the protocol, in both the coin and its
/// currency, on every trade wherever it was made.
///
/// The coin is always the pool's token0: the creator brings a salt whose clone
/// address sorts below the currency (a few tries in the browser), so the price
/// always reads as currency per coin and the position always sits above it.
///
/// The currency a coin is paired with is written once, at launch, and there is
/// no function that changes it, moves the position, or lowers its liquidity.
contract Launchpad is Ownable, ReentrancyGuard, IUniswapV3SwapCallback {
    using SafeTransferLib for address;

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000e18;
    /// @notice The pool's fee tier: 1%, of which half is the creator's.
    uint24 public constant POOL_FEE = 10_000;
    int24 public constant TICK_SPACING = 200;
    /// @notice The highest tick the position reaches (the top of Uniswap's scale, on the spacing).
    int24 public constant TICK_TOP = 887_200;
    uint160 internal constant MIN_SQRT_RATIO = 4_295_128_739;
    uint160 internal constant MAX_SQRT_RATIO = 1_461_446_703_485_210_103_287_273_052_203_988_822_378_723_970_342;
    uint256 internal constant Q96 = 2 ** 96;

    uint256 internal constant BPS = 10_000;
    uint256 public constant MAX_NAME_BYTES = 40;
    uint256 public constant MAX_SYMBOL_BYTES = 10;
    uint256 public constant MAX_META_BYTES = 8_192;

    /*//////////////////////////////////////////////////////////////
                                 TYPES
    //////////////////////////////////////////////////////////////*/

    struct Market {
        address creator;
        uint64 createdAt;
        address currency;
        // The coin's Uniswap V3 pool with its currency (coin is token0).
        address pool;
        // The pad's position in it: the whole supply, from the launch price up.
        uint256 tokenId;
        int24 tickLower;
        // The position's liquidity and the sqrt price (x2^96) of its lower tick, where
        // trading starts: until the first buy the pool's price sits just below it.
        uint128 liquidity;
        uint160 sqrtLowerX96;
        // What the market opened at, in currency units for the whole supply.
        uint256 startQuote;
        // Currency traded through the pad (gross); trades made straight on the pool are in its events.
        uint256 volume;
        // Fees collected so far, in the currency, for the creator and the protocol.
        uint256 creatorFees;
        uint256 protocolFees;
    }

    struct CoinView {
        address coin;
        string name;
        string symbol;
        address creator;
        address currency;
        uint64 createdAt;
        address pool;
        uint256 tokenId;
        uint256 startQuote;
        // The pool as a constant-product curve right now: virtual reserves, the price
        // being their ratio, and the currency the pool really holds.
        uint256 reserveToken;
        uint256 reserveQuote;
        uint256 realQuote;
        uint160 sqrtPriceX96;
        uint128 liquidity;
        uint256 volume;
        uint256 creatorFees;
        uint256 protocolFees;
    }

    /*//////////////////////////////////////////////////////////////
                                 STATE
    //////////////////////////////////////////////////////////////*/

    CurrencyDesk public immutable desk;
    INonfungiblePositionManager public immutable positions;
    IUniswapV3Factory public immutable uniswapFactory;
    address public immutable coinImplementation;

    address public treasury;
    address public router;
    /// @notice What a coin's whole supply is worth the moment it launches, in USD with 18 decimals.
    uint256 public startMcapUsd;

    mapping(address coin => Market) internal _markets;
    address[] public allCoins;
    mapping(address currency => uint256) public coinsIn;
    /// @dev The pool a swap is in flight on, so its callback can be trusted.
    address internal _swapping;

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
        address pool,
        uint256 tokenId,
        uint256 startQuote
    );
    event Trade(
        address indexed coin,
        address indexed trader,
        bool isBuy,
        uint256 quoteAmount,
        uint256 tokenAmount,
        uint256 fee,
        uint160 sqrtPriceX96,
        uint256 timestamp
    );
    event FeesCollected(
        address indexed coin, address indexed creator, uint256 creatorCoin, uint256 creatorQuote, uint256 protocolCoin, uint256 protocolQuote
    );
    event StartMcapSet(uint256 startMcapUsd);
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
    error BadSalt();
    error PoolTaken();
    error Slippage();
    error ZeroAmount();
    error BadStart();
    error NotRouter();
    error NotPool();
    error ZeroAddress();

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        address owner_,
        CurrencyDesk desk_,
        INonfungiblePositionManager positions_,
        address treasury_,
        uint256 startMcapUsd_
    ) {
        if (treasury_ == address(0) || address(desk_) == address(0) || address(positions_) == address(0)) {
            revert ZeroAddress();
        }
        if (startMcapUsd_ == 0) revert BadStart();
        _initializeOwner(owner_);
        desk = desk_;
        positions = positions_;
        uniswapFactory = IUniswapV3Factory(positions_.factory());
        coinImplementation = address(new Coin());
        treasury = treasury_;
        startMcapUsd = startMcapUsd_;
    }

    /*//////////////////////////////////////////////////////////////
                                LAUNCH
    //////////////////////////////////////////////////////////////*/

    /// @notice Launches a coin paired with `currency`, optionally buying some in the same transaction.
    /// @param meta JSON with name, symbol, description, image and links; stored in the coin (ERC-7572).
    /// @param salt Picked so that `coinAddress(salt)` sorts below `currency` (see `coinAddress`).
    /// @param firstBuy Currency to spend on the creator's first buy, in the same transaction; 0 for none.
    function createCoin(
        string calldata name_,
        string calldata symbol_,
        string calldata meta,
        address currency,
        bytes32 salt,
        uint256 firstBuy,
        uint256 minTokensOut
    ) external nonReentrant returns (address coin, uint256 tokensOut) {
        _validateName(name_);
        _validateSymbol(symbol_);
        if (bytes(meta).length > MAX_META_BYTES) revert MetaTooLong();
        coin = _open(name_, symbol_, meta, currency, salt);
        if (firstBuy != 0) tokensOut = _buy(coin, _markets[coin], firstBuy, minTokensOut, msg.sender, msg.sender);
    }

    /// @notice The address a coin launched with `salt` gets, by whoever launches it. Pick a
    /// salt that makes it sort below the currency's address.
    function coinAddress(bytes32 salt) external view returns (address) {
        return LibClone.predictDeterministicAddress(coinImplementation, salt, address(this));
    }

    /// @notice keccak256 of the clone's init code, to predict `coinAddress` without a call.
    function coinInitCodeHash() external view returns (bytes32) {
        return LibClone.initCodeHash(coinImplementation);
    }

    function _open(string calldata name_, string calldata symbol_, string calldata meta, address currency, bytes32 salt)
        internal
        returns (address coin)
    {
        if (!desk.isListed(currency)) revert CurrencyNotListed(currency);
        uint256 startQuote = startQuoteFor(currency);
        if (startQuote == 0) revert BadStart();

        coin = LibClone.cloneDeterministic(coinImplementation, salt);
        if (coin >= currency) revert BadSalt();
        Coin(coin).initialize(name_, symbol_, TOTAL_SUPPLY, meta);

        Market storage m = _markets[coin];
        m.creator = msg.sender;
        m.createdAt = uint64(block.timestamp);
        m.currency = currency;
        m.startQuote = startQuote;
        _seedPool(coin, m);

        allCoins.push(coin);
        ++coinsIn[currency];
        emit CoinCreated(coin, msg.sender, currency, name_, symbol_, meta, m.pool, m.tokenId, startQuote);
    }

    /// @dev Opens the coin's pool at the launch price and puts the whole supply in it as the
    /// pad's position, from the first tick on the spacing above the price to the top.
    function _seedPool(address coin, Market storage m) internal {
        address currency = m.currency;
        // A pool nobody could have opened at a price of their own: the coin did not exist a moment ago.
        if (uniswapFactory.getPool(coin, currency, POOL_FEE) != address(0)) revert PoolTaken();
        address pool = positions.createAndInitializePoolIfNecessary(coin, currency, POOL_FEE, _sqrtPriceX96(m.startQuote));

        (, int24 tick,,,,,) = IUniswapV3Pool(pool).slot0();
        int24 tickLower = (tick / TICK_SPACING) * TICK_SPACING;
        if (tickLower <= tick) tickLower += TICK_SPACING;

        coin.safeApprove(address(positions), TOTAL_SUPPLY);
        (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1) = positions.mint(
            INonfungiblePositionManager.MintParams({
                token0: coin,
                token1: currency,
                fee: POOL_FEE,
                tickLower: tickLower,
                tickUpper: TICK_TOP,
                amount0Desired: TOTAL_SUPPLY,
                amount1Desired: 0,
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp
            })
        );
        if (amount1 != 0 || amount0 == 0) revert BadStart();
        m.pool = pool;
        m.tokenId = tokenId;
        m.tickLower = tickLower;
        m.liquidity = liquidity;
        // for a range that runs to the top of the scale, amount0 = L * 2^96 / sqrt(lower) to 1e-20
        uint256 sqrtLower = FixedPointMathLib.fullMulDiv(liquidity, Q96, amount0);
        if (sqrtLower >= MAX_SQRT_RATIO) revert BadStart();
        m.sqrtLowerX96 = uint160(sqrtLower);
    }

    /// @dev sqrt(price) * 2^96 for a price of `startQuote` currency units per whole supply.
    function _sqrtPriceX96(uint256 startQuote) internal pure returns (uint160) {
        uint256 priceX192 = FixedPointMathLib.fullMulDiv(startQuote, Q96 * Q96, TOTAL_SUPPLY);
        uint256 s = FixedPointMathLib.sqrt(priceX192);
        if (s <= MIN_SQRT_RATIO || s >= MAX_SQRT_RATIO) revert BadStart();
        return uint160(s);
    }

    /*//////////////////////////////////////////////////////////////
                                 TRADE
    //////////////////////////////////////////////////////////////*/

    /// @notice Spends `quoteIn` of the coin's currency on the coin, in its pool.
    function buy(address coin, uint256 quoteIn, uint256 minTokensOut, address recipient)
        external
        nonReentrant
        returns (uint256 tokensOut, uint256 quoteUsed)
    {
        if (quoteIn == 0) revert ZeroAmount();
        return (_buy(coin, _market(coin), quoteIn, minTokensOut, recipient, recipient), quoteIn);
    }

    /// @notice Sells `tokensIn` of the coin for its currency, in its pool.
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

    /// @notice Pays out the fees the coin's pool has earned: half to its creator, half to the
    /// protocol, in the coin and in its currency. Anyone may call it.
    function collectFees(address coin) external nonReentrant returns (uint256 coinFees, uint256 quoteFees) {
        Market storage m = _market(coin);
        (coinFees, quoteFees) = positions.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: m.tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );
        uint256 creatorCoin = coinFees / 2;
        uint256 creatorQuote = quoteFees / 2;
        if (creatorCoin != 0) coin.safeTransfer(m.creator, creatorCoin);
        if (creatorQuote != 0) m.currency.safeTransfer(m.creator, creatorQuote);
        if (coinFees - creatorCoin != 0) coin.safeTransfer(treasury, coinFees - creatorCoin);
        if (quoteFees - creatorQuote != 0) m.currency.safeTransfer(treasury, quoteFees - creatorQuote);
        m.creatorFees += creatorQuote;
        m.protocolFees += quoteFees - creatorQuote;
        emit FeesCollected(coin, m.creator, creatorCoin, creatorQuote, coinFees - creatorCoin, quoteFees - creatorQuote);
    }

    /// @dev The pool asks for the input of the swap in flight.
    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external {
        if (msg.sender != _swapping || _swapping == address(0)) revert NotPool();
        (address coin, address currency) = abi.decode(data, (address, address));
        if (amount0Delta > 0) coin.safeTransfer(msg.sender, uint256(amount0Delta));
        if (amount1Delta > 0) currency.safeTransfer(msg.sender, uint256(amount1Delta));
    }

    /*//////////////////////////////////////////////////////////////
                                INTERNALS
    //////////////////////////////////////////////////////////////*/

    function _buy(address coin, Market storage m, uint256 quoteIn, uint256 minTokensOut, address recipient, address trader)
        internal
        returns (uint256 tokensOut)
    {
        m.currency.safeTransferFrom(msg.sender, address(this), quoteIn);
        (int256 amount0,) = _swap(coin, m, false, quoteIn, recipient);
        tokensOut = uint256(-amount0);
        if (tokensOut == 0 || tokensOut < minTokensOut) revert Slippage();
        m.volume += quoteIn;
        (uint160 sqrtPriceX96,,,,,,) = IUniswapV3Pool(m.pool).slot0();
        emit Trade(coin, trader, true, quoteIn, tokensOut, quoteIn * POOL_FEE / 1_000_000, sqrtPriceX96, block.timestamp);
    }

    function _sell(address coin, uint256 tokensIn, uint256 minQuoteOut, address recipient, address trader)
        internal
        returns (uint256 quoteOut)
    {
        if (tokensIn == 0) revert ZeroAmount();
        Market storage m = _market(coin);
        coin.safeTransferFrom(msg.sender, address(this), tokensIn);
        (, int256 amount1) = _swap(coin, m, true, tokensIn, recipient);
        quoteOut = uint256(-amount1);
        if (quoteOut == 0 || quoteOut < minQuoteOut) revert Slippage();
        m.volume += quoteOut;
        (uint160 sqrtPriceX96,,,,,,) = IUniswapV3Pool(m.pool).slot0();
        // the fee came off the coins going in; in currency terms it is 1% of the gross
        emit Trade(coin, trader, false, quoteOut, tokensIn, quoteOut * POOL_FEE / (1_000_000 - POOL_FEE), sqrtPriceX96, block.timestamp);
    }

    /// @dev An exact-input swap on the coin's pool, the input already held by the pad.
    function _swap(address coin, Market storage m, bool zeroForOne, uint256 amountIn, address recipient)
        internal
        returns (int256 amount0, int256 amount1)
    {
        _swapping = m.pool;
        (amount0, amount1) = IUniswapV3Pool(m.pool).swap(
            recipient,
            zeroForOne,
            int256(amountIn),
            zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1,
            abi.encode(coin, m.currency)
        );
        _swapping = address(0);
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

    /// @notice What a coin's whole supply is worth at launch, in `currency`, if launched now.
    function startQuoteFor(address currency) public view returns (uint256) {
        return desk.fromUsd(currency, startMcapUsd);
    }

    /// @notice The pool as a constant-product curve: (virtual coin reserve, virtual currency reserve),
    /// whose ratio is the price, from the pool's price and its liquidity in range.
    function reserves(address coin) public view returns (uint256 reserveToken, uint256 reserveQuote) {
        (reserveToken, reserveQuote,,) = _reservesOf(_market(coin));
    }

    /// @dev The pool's price and liquidity where trading happens: its own once the price is inside
    /// the pad's position, the position's lower edge before the first buy takes it there.
    function _reservesOf(Market storage m)
        internal
        view
        returns (uint256 reserveToken, uint256 reserveQuote, uint160 sqrtPriceX96, uint128 liquidity)
    {
        IUniswapV3Pool pool = IUniswapV3Pool(m.pool);
        (sqrtPriceX96,,,,,,) = pool.slot0();
        liquidity = pool.liquidity();
        if (sqrtPriceX96 < m.sqrtLowerX96 || liquidity == 0) {
            sqrtPriceX96 = m.sqrtLowerX96;
            liquidity = m.liquidity;
        }
        reserveToken = FixedPointMathLib.fullMulDiv(liquidity, Q96, sqrtPriceX96);
        reserveQuote = FixedPointMathLib.fullMulDiv(liquidity, sqrtPriceX96, Q96);
    }

    /// @notice What `quoteIn` buys right now, and the fee inside it (the pool's 1%). Exact while
    /// the pad's position is the only liquidity in range, which it is unless someone adds more.
    function quoteBuy(address coin, uint256 quoteIn)
        external
        view
        returns (uint256 tokensOut, uint256 quoteUsed, uint256 fees, uint256 snipeTax)
    {
        (uint256 rToken, uint256 rQuote) = reserves(coin);
        uint256 net = quoteIn * (1_000_000 - POOL_FEE) / 1_000_000;
        tokensOut = FixedPointMathLib.fullMulDiv(rToken, net, rQuote + net);
        return (tokensOut, quoteIn, quoteIn - net, 0);
    }

    function quoteSell(address coin, uint256 tokensIn) external view returns (uint256 quoteOut, uint256 fees) {
        (uint256 rToken, uint256 rQuote) = reserves(coin);
        uint256 net = tokensIn * (1_000_000 - POOL_FEE) / 1_000_000;
        quoteOut = FixedPointMathLib.fullMulDiv(rQuote, net, rToken + net);
        uint256 gross = FixedPointMathLib.fullMulDiv(rQuote, tokensIn, rToken + tokensIn);
        fees = gross > quoteOut ? gross - quoteOut : 0;
    }

    /// @notice The first buy's output for a coin not launched yet, at the launch price.
    function quoteLaunchBuy(address currency, uint256 quoteIn) external view returns (uint256 tokensOut) {
        uint256 startQuote = startQuoteFor(currency);
        uint256 net = quoteIn * (1_000_000 - POOL_FEE) / 1_000_000;
        tokensOut = FixedPointMathLib.fullMulDiv(TOTAL_SUPPLY, net, startQuote + net);
    }

    function isCoin(address coin) external view returns (bool) {
        return _markets[coin].creator != address(0);
    }

    function currencyOf(address coin) external view returns (address) {
        return _market(coin).currency;
    }

    /// @notice The coin's Uniswap V3 pool with its currency.
    function poolOf(address coin) external view returns (address) {
        return _market(coin).pool;
    }

    function getMarket(address coin) external view returns (Market memory) {
        return _market(coin);
    }

    function coinsCount() external view returns (uint256) {
        return allCoins.length;
    }

    /// @notice A page of markets with their names, symbols and live pool numbers, in launch order.
    function getCoins(uint256 offset, uint256 limit) external view returns (CoinView[] memory page) {
        uint256 total = allCoins.length;
        if (offset >= total) return page;
        uint256 end = offset + limit > total ? total : offset + limit;
        page = new CoinView[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            page[i - offset] = _view(allCoins[i]);
        }
    }

    function _view(address coin) internal view returns (CoinView memory v) {
        Market storage m = _markets[coin];
        (uint256 rToken, uint256 rQuote, uint160 sqrtPriceX96, uint128 liquidity) = _reservesOf(m);
        v.coin = coin;
        v.name = Coin(coin).name();
        v.symbol = Coin(coin).symbol();
        v.creator = m.creator;
        v.currency = m.currency;
        v.createdAt = m.createdAt;
        v.pool = m.pool;
        v.tokenId = m.tokenId;
        v.startQuote = m.startQuote;
        v.reserveToken = rToken;
        v.reserveQuote = rQuote;
        v.realQuote = Coin(m.currency).balanceOf(m.pool);
        v.sqrtPriceX96 = sqrtPriceX96;
        v.liquidity = liquidity;
        v.volume = m.volume;
        v.creatorFees = m.creatorFees;
        v.protocolFees = m.protocolFees;
    }

    /*//////////////////////////////////////////////////////////////
                                 ADMIN
    //////////////////////////////////////////////////////////////*/

    function setStartMcapUsd(uint256 startMcapUsd_) external onlyOwner {
        if (startMcapUsd_ == 0) revert BadStart();
        startMcapUsd = startMcapUsd_;
        emit StartMcapSet(startMcapUsd_);
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
