// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "solady/auth/Ownable.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";
import {LibClone} from "solady/utils/LibClone.sol";
import {TestCurrency} from "./TestCurrency.sol";

interface IERC20Decimals {
    function decimals() external view returns (uint8);
}

/// @title CurrencyDesk
/// @notice The allow-list of currencies a coin can be paired with, the USD rate
/// of each one, and a counter that converts between them at those rates.
/// @dev Rates are "units of the currency per one US dollar" in 18-decimal fixed
/// point: EUR at 0.86e18, JPY at 148e18. A keeper posts them; each post can move
/// a rate by at most MAX_KEEPER_MOVE_BPS, so a bad feed cannot drag a rate far in
/// one step. Test currencies are minted and burned by the desk, which makes the
/// counter infinitely deep on a test network. Listed external tokens (real
/// stablecoins) are paid out of whatever reserve the desk holds instead.
contract CurrencyDesk is Ownable {
    using SafeTransferLib for address;

    struct Currency {
        address token;
        uint8 decimals;
        bool mintable;
        uint64 updatedAt;
        uint256 rate;
        string code;
    }

    struct NewTestCurrency {
        string code;
        string name;
        string symbol;
        uint8 decimals;
        uint256 rate;
    }

    uint256 internal constant BPS = 10_000;
    uint256 public constant MAX_FEE_BPS = 100;
    uint256 public constant MAX_KEEPER_MOVE_BPS = 2_000;
    uint256 public constant MAX_FAUCET_USD = 1_000_000e18;

    /// @notice The TestCurrency every test currency is cloned from.
    address public immutable currencyImplementation;

    Currency[] private _currencies;
    mapping(address token => uint256) private _slot; // index + 1
    mapping(bytes32 codeHash => address) public tokenOfCode;

    mapping(address => bool) public isKeeper;

    uint16 public feeBps;
    uint256 public faucetUsd;
    uint32 public faucetCooldown;
    mapping(address user => mapping(address token => uint64)) public lastFaucet;

    event CurrencyListed(address indexed token, string code, uint8 decimals, bool mintable, uint256 rate);
    event RateUpdated(address indexed token, uint256 oldRate, uint256 newRate);
    event Converted(
        address indexed user,
        address indexed from,
        address indexed to,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee,
        address recipient
    );
    event FaucetClaimed(address indexed user, address indexed token, uint256 amount);
    event KeeperSet(address indexed keeper, bool allowed);
    event FeeSet(uint16 feeBps);
    event FaucetSet(uint256 faucetUsd, uint32 cooldown);

    error NotKeeper();
    error NotListed(address token);
    error AlreadyListed(address token);
    error CodeTaken(string code);
    error BadRate();
    error RateMoveTooLarge(address token, uint256 oldRate, uint256 newRate);
    error LengthMismatch();
    error SameCurrency();
    error Slippage();
    error FeeTooHigh();
    error NotMintable(address token);
    error FaucetOff();
    error FaucetCooldown(uint256 readyAt);
    error BadCode();

    modifier onlyKeeper() {
        if (!isKeeper[msg.sender] && msg.sender != owner()) revert NotKeeper();
        _;
    }

    constructor(address owner_, uint16 feeBps_, uint256 faucetUsd_, uint32 faucetCooldown_) {
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        _initializeOwner(owner_);
        currencyImplementation = address(new TestCurrency());
        feeBps = feeBps_;
        faucetUsd = faucetUsd_ > MAX_FAUCET_USD ? MAX_FAUCET_USD : faucetUsd_;
        faucetCooldown = faucetCooldown_;
    }

    /*//////////////////////////////////////////////////////////////
                               LISTING
    //////////////////////////////////////////////////////////////*/

    /// @notice Deploys and lists test currencies in one go.
    function createTestCurrencies(NewTestCurrency[] calldata list) external onlyOwner returns (address[] memory tokens) {
        tokens = new address[](list.length);
        for (uint256 i; i < list.length; ++i) {
            tokens[i] = _createTestCurrency(list[i]);
        }
    }

    function _createTestCurrency(NewTestCurrency calldata c) internal returns (address token) {
        token = LibClone.clone(currencyImplementation);
        TestCurrency(token).initialize(c.name, c.symbol, c.decimals);
        _list(token, c.code, c.decimals, true, c.rate);
    }

    /// @notice Lists an existing token (a real stablecoin) as a currency.
    function listCurrency(address token, string calldata code, uint256 rate) external onlyOwner {
        _list(token, code, IERC20Decimals(token).decimals(), false, rate);
    }

    function _list(address token, string calldata code, uint8 decimals, bool mintable, uint256 rate) internal {
        if (_slot[token] != 0) revert AlreadyListed(token);
        if (rate == 0) revert BadRate();
        bytes memory raw = bytes(code);
        if (raw.length == 0 || raw.length > 8) revert BadCode();
        bytes32 codeHash = keccak256(raw);
        if (tokenOfCode[codeHash] != address(0)) revert CodeTaken(code);
        _currencies.push(
            Currency({
                token: token,
                decimals: decimals,
                mintable: mintable,
                updatedAt: uint64(block.timestamp),
                rate: rate,
                code: code
            })
        );
        _slot[token] = _currencies.length;
        tokenOfCode[codeHash] = token;
        emit CurrencyListed(token, code, decimals, mintable, rate);
    }

    /*//////////////////////////////////////////////////////////////
                                RATES
    //////////////////////////////////////////////////////////////*/

    /// @notice Posts new rates. Each one may move at most MAX_KEEPER_MOVE_BPS.
    /// @dev The keeper only calls this when its independent feeds agree; the
    /// bound here is the on-chain backstop if that logic ever fails.
    function setRates(address[] calldata tokens, uint256[] calldata rates) external onlyKeeper {
        if (tokens.length != rates.length) revert LengthMismatch();
        for (uint256 i; i < tokens.length; ++i) {
            Currency storage c = _get(tokens[i]);
            uint256 oldRate = c.rate;
            uint256 newRate = rates[i];
            if (newRate == 0) revert BadRate();
            uint256 diff = newRate > oldRate ? newRate - oldRate : oldRate - newRate;
            if (diff * BPS > oldRate * MAX_KEEPER_MOVE_BPS) revert RateMoveTooLarge(tokens[i], oldRate, newRate);
            c.rate = newRate;
            c.updatedAt = uint64(block.timestamp);
            emit RateUpdated(tokens[i], oldRate, newRate);
        }
    }

    /// @notice Owner override for a rate, with no move bound (redenominations, pegs breaking).
    function forceRate(address token, uint256 rate) external onlyOwner {
        if (rate == 0) revert BadRate();
        Currency storage c = _get(token);
        emit RateUpdated(token, c.rate, rate);
        c.rate = rate;
        c.updatedAt = uint64(block.timestamp);
    }

    /*//////////////////////////////////////////////////////////////
                               CONVERT
    //////////////////////////////////////////////////////////////*/

    /// @notice Converts `amountIn` of `from` into `to` at the posted rates, less the desk fee.
    function convert(address from, address to, uint256 amountIn, uint256 minOut, address recipient)
        external
        returns (uint256 amountOut)
    {
        uint256 fee;
        (amountOut, fee) = quoteConvert(from, to, amountIn);
        if (amountOut < minOut || amountOut == 0) revert Slippage();

        Currency storage cf = _currencies[_slot[from] - 1];
        Currency storage ct = _currencies[_slot[to] - 1];

        from.safeTransferFrom(msg.sender, address(this), amountIn);
        if (cf.mintable) TestCurrency(from).burn(amountIn);

        if (ct.mintable) TestCurrency(to).mint(recipient, amountOut);
        else to.safeTransfer(recipient, amountOut);

        emit Converted(msg.sender, from, to, amountIn, amountOut, fee, recipient);
    }

    function quoteConvert(address from, address to, uint256 amountIn)
        public
        view
        returns (uint256 amountOut, uint256 fee)
    {
        if (from == to) revert SameCurrency();
        Currency storage cf = _get(from);
        Currency storage ct = _get(to);
        // amountIn / 10^df / rateFrom = USD; USD * rateTo * 10^dt = gross
        uint256 gross =
            FixedPointMathLib.fullMulDiv(amountIn, ct.rate * 10 ** ct.decimals, cf.rate * 10 ** cf.decimals);
        fee = gross * feeBps / BPS;
        amountOut = gross - fee;
    }

    /*//////////////////////////////////////////////////////////////
                                FAUCET
    //////////////////////////////////////////////////////////////*/

    /// @notice Mints `faucetUsd` worth of a test currency to the caller, once per cooldown.
    function faucet(address token) external returns (uint256 amount) {
        Currency storage c = _get(token);
        if (!c.mintable) revert NotMintable(token);
        if (faucetUsd == 0) revert FaucetOff();
        uint256 readyAt = uint256(lastFaucet[msg.sender][token]) + faucetCooldown;
        if (lastFaucet[msg.sender][token] != 0 && block.timestamp < readyAt) revert FaucetCooldown(readyAt);
        lastFaucet[msg.sender][token] = uint64(block.timestamp);
        amount = fromUsd(token, faucetUsd);
        TestCurrency(token).mint(msg.sender, amount);
        emit FaucetClaimed(msg.sender, token, amount);
    }

    /*//////////////////////////////////////////////////////////////
                                ADMIN
    //////////////////////////////////////////////////////////////*/

    function setKeeper(address keeper, bool allowed) external onlyOwner {
        isKeeper[keeper] = allowed;
        emit KeeperSet(keeper, allowed);
    }

    function setFee(uint16 feeBps_) external onlyOwner {
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = feeBps_;
        emit FeeSet(feeBps_);
    }

    function setFaucet(uint256 faucetUsd_, uint32 cooldown) external onlyOwner {
        faucetUsd = faucetUsd_ > MAX_FAUCET_USD ? MAX_FAUCET_USD : faucetUsd_;
        faucetCooldown = cooldown;
        emit FaucetSet(faucetUsd, cooldown);
    }

    /// @notice Moves reserve of an external (non-mintable) currency. Test currencies have no reserve.
    function withdrawReserve(address token, uint256 amount, address to) external onlyOwner {
        token.safeTransfer(to, amount);
    }

    /*//////////////////////////////////////////////////////////////
                                VIEWS
    //////////////////////////////////////////////////////////////*/

    function isListed(address token) public view returns (bool) {
        return _slot[token] != 0;
    }

    function currencyCount() external view returns (uint256) {
        return _currencies.length;
    }

    function getCurrency(address token) external view returns (Currency memory) {
        return _get(token);
    }

    function getCurrencies() external view returns (Currency[] memory) {
        return _currencies;
    }

    function rateOf(address token) external view returns (uint256) {
        return _get(token).rate;
    }

    /// @notice USD value (18 decimals) of `amount` of `token`.
    function toUsd(address token, uint256 amount) public view returns (uint256) {
        Currency storage c = _get(token);
        return FixedPointMathLib.fullMulDiv(amount, 1e36, c.rate * 10 ** c.decimals);
    }

    /// @notice Amount of `token` worth `usd` (18 decimals).
    function fromUsd(address token, uint256 usd) public view returns (uint256) {
        Currency storage c = _get(token);
        return FixedPointMathLib.fullMulDiv(usd, c.rate * 10 ** c.decimals, 1e36);
    }

    function faucetAmount(address token) external view returns (uint256) {
        return fromUsd(token, faucetUsd);
    }

    function _get(address token) internal view returns (Currency storage) {
        uint256 s = _slot[token];
        if (s == 0) revert NotListed(token);
        return _currencies[s - 1];
    }
}
