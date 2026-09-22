// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SafeTransfer} from "./lib/SafeTransfer.sol";
import {LilyPadToken} from "./LilyPadToken.sol";
import {LilyPadCurve} from "./LilyPadCurve.sol";

/// @title LilyPadFactory
/// @notice Pairs a new coin with a tokenized stock: deploys the coin, mints its whole supply
///         to a fresh bonding curve quoted in that stock, and (optionally) makes the creator's
///         first buy in the same transaction. Keeps the list of approved stocks and their
///         economics, the fee schedule, and the graduator every curve hands over to.
contract LilyPadFactory {
    using SafeTransfer for address;

    struct Stock {
        uint256 phantomQuote;        // virtual reserve at launch, in the stock's units
        uint256 graduationThreshold; // real stock that closes the curve, in the stock's units
        bool enabled;
    }

    struct LaunchParams {
        string name;
        string symbol;
        string metadata;             // logo URL, description, socials: a JSON string or URI, stored in the event only
        address stock;
        uint16 creatorTaxBps;
        address[] snipeExemptions;
        uint256 devBuyQuote;         // first buy in the stock, 0 for none; approve it to the factory first
        uint256 minDevTokens;
        bytes32 salt;                // makes the curve and token addresses deterministic per creator
    }

    uint256 public constant SUPPLY = 1_000_000_000e18;
    uint256 public constant MAX_EXEMPTIONS = 32;

    address public owner;
    address public pendingOwner;
    address public treasury;
    address public graduator;
    uint256 public launchFee;        // ETH per launch
    uint16 public feeBps = 100;      // 1% on every curve trade
    uint16 public maxCreatorTaxBps = 200;
    uint16 public graduationFeeBps = 200;
    uint16 public snipeTaxBps = 2_000;   // 20% at the first block, decaying…
    uint32 public snipeWindow = 60;      // …to 0 over 60 blocks
    bool public paused;
    uint256 public pendingLaunchFees;

    mapping(address => Stock) public stocks;
    address[] public stockList;
    mapping(address => address) public curveOf;   // coin -> curve
    address[] public allTokens;

    event PairCreated(address indexed token, address indexed curve, address indexed creator, address stock, string name, string symbol, string metadata);
    event StockSet(address indexed stock, uint256 phantomQuote, uint256 graduationThreshold, bool enabled);
    event ConfigSet(uint256 launchFee, uint16 feeBps, uint16 maxCreatorTaxBps, uint16 graduationFeeBps, uint16 snipeTaxBps, uint32 snipeWindow);
    event GraduatorSet(address graduator);
    event TreasurySet(address treasury);
    event Paused(bool paused);
    event OwnershipTransferStarted(address indexed from, address indexed to);
    event OwnershipTransferred(address indexed from, address indexed to);

    error NotOwner();
    error NotPendingOwner();
    error ZeroAddress();
    error IsPaused();
    error WrongFee(uint256 sent, uint256 required);
    error StockNotApproved(address stock);
    error CreatorTaxTooHigh(uint16 asked, uint16 max);
    error TooManyExemptions();
    error BadName();
    error BadBps();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address treasury_, address graduator_, uint256 launchFee_) {
        if (treasury_ == address(0)) revert ZeroAddress();
        owner = treasury_ == address(0) ? msg.sender : msg.sender;
        treasury = treasury_;
        graduator = graduator_;
        launchFee = launchFee_;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ------------------------------------------------------------------ launching

    /// @notice Create a coin paired with `p.stock`. Send exactly `launchFee` in ETH. If
    ///         `p.devBuyQuote` > 0, approve that much of the stock to the factory first; the
    ///         buy lands in this same transaction and the creator pays no snipe tax.
    function launch(LaunchParams calldata p) external payable returns (address token, address curve) {
        if (paused) revert IsPaused();
        if (msg.value != launchFee) revert WrongFee(msg.value, launchFee);
        Stock memory s = stocks[p.stock];
        if (!s.enabled) revert StockNotApproved(p.stock);
        if (p.creatorTaxBps > maxCreatorTaxBps) revert CreatorTaxTooHigh(p.creatorTaxBps, maxCreatorTaxBps);
        if (p.snipeExemptions.length > MAX_EXEMPTIONS) revert TooManyExemptions();
        uint256 nameLen = bytes(p.name).length; uint256 symLen = bytes(p.symbol).length;
        if (nameLen == 0 || nameLen > 40 || symLen < 2 || symLen > 8) revert BadName();

        bytes32 salt = keccak256(abi.encode(msg.sender, p.salt, allTokens.length));
        LilyPadCurve c = new LilyPadCurve{salt: salt}(LilyPadCurve.Params({
            quote: p.stock,
            creator: msg.sender,
            phantomQuote: s.phantomQuote,
            graduationThreshold: s.graduationThreshold,
            feeBps: feeBps,
            creatorTaxBps: p.creatorTaxBps,
            graduationFeeBps: graduationFeeBps,
            snipeTaxBps: snipeTaxBps,
            snipeWindow: snipeWindow
        }));
        LilyPadToken t = new LilyPadToken{salt: salt}(p.name, p.symbol, SUPPLY, address(c));
        c.initialize(address(t), p.snipeExemptions);

        token = address(t);
        curve = address(c);
        curveOf[token] = curve;
        allTokens.push(token);
        pendingLaunchFees += msg.value;
        emit PairCreated(token, curve, msg.sender, p.stock, p.name, p.symbol, p.metadata);

        if (p.devBuyQuote > 0) {
            p.stock.safeTransferFrom(msg.sender, address(this), p.devBuyQuote);
            p.stock.safeApprove(curve, p.devBuyQuote);
            c.buy(p.devBuyQuote, p.minDevTokens, msg.sender);
            p.stock.safeApprove(curve, 0);
        }
    }

    function allTokensLength() external view returns (uint256) { return allTokens.length; }
    function stockListLength() external view returns (uint256) { return stockList.length; }

    /// @notice Moves the collected launch fees to the treasury. Anyone may call.
    function withdrawLaunchFees() external {
        uint256 amount = pendingLaunchFees;
        pendingLaunchFees = 0;
        (bool ok, ) = treasury.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    // ------------------------------------------------------------------ governance

    function setStock(address stock, uint256 phantomQuote, uint256 graduationThreshold, bool enabled) external onlyOwner {
        if (stock == address(0)) revert ZeroAddress();
        if (stocks[stock].phantomQuote == 0 && stocks[stock].graduationThreshold == 0) stockList.push(stock);
        stocks[stock] = Stock(phantomQuote, graduationThreshold, enabled);
        emit StockSet(stock, phantomQuote, graduationThreshold, enabled);
    }

    function setConfig(uint256 launchFee_, uint16 feeBps_, uint16 maxCreatorTaxBps_, uint16 graduationFeeBps_, uint16 snipeTaxBps_, uint32 snipeWindow_) external onlyOwner {
        if (feeBps_ > 500 || maxCreatorTaxBps_ > 1_000 || graduationFeeBps_ > 1_000 || snipeTaxBps_ > 5_000) revert BadBps();
        launchFee = launchFee_; feeBps = feeBps_; maxCreatorTaxBps = maxCreatorTaxBps_;
        graduationFeeBps = graduationFeeBps_; snipeTaxBps = snipeTaxBps_; snipeWindow = snipeWindow_;
        emit ConfigSet(launchFee_, feeBps_, maxCreatorTaxBps_, graduationFeeBps_, snipeTaxBps_, snipeWindow_);
    }

    function setGraduator(address graduator_) external onlyOwner { graduator = graduator_; emit GraduatorSet(graduator_); }
    function setTreasury(address treasury_) external onlyOwner { if (treasury_ == address(0)) revert ZeroAddress(); treasury = treasury_; emit TreasurySet(treasury_); }
    function setPaused(bool paused_) external onlyOwner { paused = paused_; emit Paused(paused_); }

    function transferOwnership(address to) external onlyOwner { pendingOwner = to; emit OwnershipTransferStarted(owner, to); }
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender; pendingOwner = address(0);
    }
}
