// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SafeTransfer} from "./lib/SafeTransfer.sol";
import {IGraduator} from "./interfaces/IGraduator.sol";
import {ILilyPadFactory} from "./interfaces/ILilyPadFactory.sol";

/// @title LilyPadCurve
/// @notice One coin, one stock. A constant-product bonding curve whose quote asset is a
///         tokenized stock (NVDA, TSLA, SPY…). Buys pay stock in, sells take stock out, and
///         when the curve holds `graduationThreshold` of the stock it seeds a permanent pool
///         through the factory's graduator and closes.
///
///         Price: virtual quote reserve  Qv = phantomQuote + quoteReserve
///                token reserve          T  = coins still on the curve
///                buy:  tokensOut = net * T / (Qv + net)
///                sell: quoteOut  = tokensIn * Qv / (T + tokensIn)
///         The phantom reserve gives the first buy a price instead of zero; it is never paid
///         out, so the real stock in the curve always covers every sell.
contract LilyPadCurve {
    using SafeTransfer for address;

    struct Params {
        address quote;              // the stock token
        address creator;            // fee recipient for the creator tax
        uint256 phantomQuote;       // in quote units
        uint256 graduationThreshold;// real quote reserve that triggers graduation, in quote units
        uint16 feeBps;              // protocol fee on every trade
        uint16 creatorTaxBps;       // creator's cut on every trade
        uint16 graduationFeeBps;    // protocol cut of the raised stock at graduation
        uint16 snipeTaxBps;         // extra tax on buys at the first block, decaying to 0
        uint32 snipeWindow;         // blocks over which the snipe tax decays
    }

    uint256 private constant BPS = 10_000;
    address private constant DEAD = 0x000000000000000000000000000000000000dEaD;

    ILilyPadFactory public immutable factory;
    address public immutable quote;
    address public immutable creator;
    uint256 public immutable phantomQuote;
    uint256 public immutable graduationThreshold;
    uint16 public immutable feeBps;
    uint16 public immutable creatorTaxBps;
    uint16 public immutable graduationFeeBps;
    uint16 public immutable snipeTaxBps;
    uint32 public immutable snipeWindow;

    address public token;
    uint256 public launchBlock;
    uint256 public tokenReserve;     // coins on the curve
    uint256 public quoteReserve;     // real stock in the curve (fees excluded)
    uint256 public protocolFees;     // stock owed to the treasury
    uint256 public creatorFees;      // stock owed to the creator
    bool public graduated;
    address public pool;
    mapping(address => bool) public snipeExempt;

    uint256 private _lock = 1;

    event Buy(address indexed buyer, address indexed recipient, uint256 quoteIn, uint256 tokensOut, uint256 fee, uint256 creatorFee, uint256 snipeTax);
    event Sell(address indexed seller, address indexed recipient, uint256 tokensIn, uint256 quoteOut, uint256 fee, uint256 creatorFee);
    event Graduated(address indexed pool, uint256 tokensToPool, uint256 quoteToPool, uint256 tokensBurned, uint256 graduationFee);
    event FeesClaimed(address indexed to, uint256 amount, bool protocol);

    error NotFactory();
    error AlreadyInitialized();
    error NotInitialized();
    error Reentrancy();
    error Graduated_();
    error NotGraduating();
    error ZeroAmount();
    error Slippage();
    error EmptyCurve();
    error NoGraduator();
    error PoolMissing();

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    modifier open() {
        if (token == address(0)) revert NotInitialized();
        if (graduated) revert Graduated_();
        _;
    }

    constructor(Params memory p) {
        factory = ILilyPadFactory(msg.sender);
        quote = p.quote;
        creator = p.creator;
        phantomQuote = p.phantomQuote;
        graduationThreshold = p.graduationThreshold;
        feeBps = p.feeBps;
        creatorTaxBps = p.creatorTaxBps;
        graduationFeeBps = p.graduationFeeBps;
        snipeTaxBps = p.snipeTaxBps;
        snipeWindow = p.snipeWindow;
    }

    /// @dev Called once by the factory right after it mints the coin's supply to this curve.
    function initialize(address token_, address[] calldata exemptions) external {
        if (msg.sender != address(factory)) revert NotFactory();
        if (token != address(0)) revert AlreadyInitialized();
        token = token_;
        launchBlock = block.number;
        tokenReserve = token_.balanceOf(address(this));
        if (tokenReserve == 0) revert EmptyCurve();
        snipeExempt[creator] = true;
        snipeExempt[msg.sender] = true;   // the factory only ever buys here for the creator's first buy, inside launch()
        for (uint256 i = 0; i < exemptions.length; i++) snipeExempt[exemptions[i]] = true;
    }

    // ------------------------------------------------------------------ views

    /// @return virtualQuote phantom + real stock, the number the price is computed from
    /// @return tokens coins still on the curve
    function getReserves() external view returns (uint256 virtualQuote, uint256 tokens) {
        return (phantomQuote + quoteReserve, tokenReserve);
    }

    /// @notice Stock per whole coin, scaled by 1e18.
    function price() external view returns (uint256) {
        if (tokenReserve == 0) return 0;
        return (phantomQuote + quoteReserve) * 1e18 / tokenReserve;
    }

    /// @notice Snipe tax a buyer would pay right now, in bps. Linear decay over `snipeWindow` blocks.
    function currentSnipeTaxBps(address buyer) public view returns (uint256) {
        if (snipeExempt[buyer] || snipeWindow == 0 || launchBlock == 0) return 0;
        uint256 elapsed = block.number - launchBlock;
        if (elapsed >= snipeWindow) return 0;
        return uint256(snipeTaxBps) * (snipeWindow - elapsed) / snipeWindow;
    }

    function quoteBuy(uint256 quoteIn, address buyer) public view returns (uint256 tokensOut, uint256 fee, uint256 creatorFee, uint256 snipeTax) {
        fee = quoteIn * feeBps / BPS;
        creatorFee = quoteIn * creatorTaxBps / BPS;
        snipeTax = quoteIn * currentSnipeTaxBps(buyer) / BPS;
        uint256 net = quoteIn - fee - creatorFee - snipeTax;
        uint256 qv = phantomQuote + quoteReserve;
        tokensOut = net * tokenReserve / (qv + net);
    }

    function quoteSell(uint256 tokensIn) public view returns (uint256 quoteOut, uint256 fee, uint256 creatorFee) {
        uint256 qv = phantomQuote + quoteReserve;
        uint256 gross = tokensIn * qv / (tokenReserve + tokensIn);
        fee = gross * feeBps / BPS;
        creatorFee = gross * creatorTaxBps / BPS;
        quoteOut = gross - fee - creatorFee;
    }

    function readyToGraduate() public view returns (bool) {
        return !graduated && quoteReserve >= graduationThreshold;
    }

    // ------------------------------------------------------------------ trading

    /// @notice Pay `quoteIn` of the stock, receive coins. Approve the stock to this curve first.
    function buy(uint256 quoteIn, uint256 minTokensOut, address recipient) external nonReentrant open returns (uint256 tokensOut) {
        if (quoteIn == 0) revert ZeroAmount();
        if (readyToGraduate()) revert NotGraduating();   // the curve is full: graduate() it

        uint256 before = quote.balanceOf(address(this));
        quote.safeTransferFrom(msg.sender, address(this), quoteIn);
        uint256 received = quote.balanceOf(address(this)) - before;   // fee-on-transfer safe

        (uint256 out, uint256 fee, uint256 creatorFee, uint256 snipeTax) = quoteBuy(received, msg.sender);
        if (out < minTokensOut) revert Slippage();
        if (out == 0 || out > tokenReserve) revert Slippage();

        protocolFees += fee;
        creatorFees += creatorFee;
        // the snipe tax stays in the curve: everyone already holding gets a better floor
        quoteReserve += received - fee - creatorFee;
        tokenReserve -= out;
        tokensOut = out;

        token.safeTransfer(recipient, out);
        emit Buy(msg.sender, recipient, received, out, fee, creatorFee, snipeTax);

        if (quoteReserve >= graduationThreshold) _graduate();
    }

    /// @notice Return coins, receive the stock. Approve the coin to this curve first.
    function sell(uint256 tokensIn, uint256 minQuoteOut, address recipient) external nonReentrant open returns (uint256 quoteOut) {
        if (tokensIn == 0) revert ZeroAmount();
        (uint256 out, uint256 fee, uint256 creatorFee) = quoteSell(tokensIn);
        if (out < minQuoteOut) revert Slippage();
        uint256 gross = out + fee + creatorFee;
        if (gross > quoteReserve) revert Slippage();   // cannot happen with a fixed phantom reserve; belt and braces

        token.safeTransferFrom(msg.sender, address(this), tokensIn);
        tokenReserve += tokensIn;
        quoteReserve -= gross;
        protocolFees += fee;
        creatorFees += creatorFee;
        quoteOut = out;

        quote.safeTransfer(recipient, out);
        emit Sell(msg.sender, recipient, tokensIn, out, fee, creatorFee);
    }

    // ------------------------------------------------------------------ graduation

    /// @notice Anyone may call it once the threshold is met; `buy` calls it on its own when a
    ///         purchase crosses the line.
    function graduate() external nonReentrant open {
        if (!readyToGraduate()) revert NotGraduating();
        _graduate();
    }

    function _graduate() private {
        address grad = factory.graduator();
        if (grad == address(0)) revert NoGraduator();
        graduated = true;

        uint256 raised = quoteReserve;
        uint256 gradFee = raised * graduationFeeBps / BPS;
        uint256 quoteToPool = raised - gradFee;
        protocolFees += gradFee;

        // the pool opens at the curve's last price, so nothing jumps at graduation
        uint256 qv = phantomQuote + raised;
        uint256 tokensToPool = quoteToPool * tokenReserve / qv;

        quoteReserve = 0;
        tokenReserve = 0;

        token.safeApprove(grad, tokensToPool);
        quote.safeApprove(grad, quoteToPool);
        address p = IGraduator(grad).graduate(token, quote, tokensToPool, quoteToPool);
        if (p == address(0)) revert PoolMissing();
        pool = p;
        token.safeApprove(grad, 0);
        quote.safeApprove(grad, 0);

        // whatever the graduator did not use: coins burn, stock goes to the treasury bucket
        uint256 leftoverTokens = token.balanceOf(address(this));
        if (leftoverTokens > 0) token.safeTransfer(DEAD, leftoverTokens);
        uint256 leftoverQuote = quote.balanceOf(address(this));
        if (leftoverQuote > protocolFees + creatorFees) protocolFees += leftoverQuote - protocolFees - creatorFees;

        emit Graduated(p, tokensToPool, quoteToPool, leftoverTokens, gradFee);
    }

    // ------------------------------------------------------------------ fees

    /// @notice Sends the protocol's accrued stock to the factory treasury. Anyone may call.
    function claimProtocolFees() external nonReentrant returns (uint256 amount) {
        amount = protocolFees;
        if (amount == 0) return 0;
        protocolFees = 0;
        address to = factory.treasury();
        quote.safeTransfer(to, amount);
        emit FeesClaimed(to, amount, true);
    }

    /// @notice Sends the creator's accrued stock to the creator. Anyone may call.
    function claimCreatorFees() external nonReentrant returns (uint256 amount) {
        amount = creatorFees;
        if (amount == 0) return 0;
        creatorFees = 0;
        quote.safeTransfer(creator, amount);
        emit FeesClaimed(creator, amount, false);
    }
}
