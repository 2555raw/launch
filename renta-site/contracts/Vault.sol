// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./RollRegistry.sol";

/// @dev The subset of ERC-20 the vault needs from the asset (EURG).
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
}

/// @title  RENTA Vault — an ERC-4626 share of rented apartments.
/// @notice One vault, one token (vRENTA), one price. The price is what the
///         vault holds — the EURG in its reserve plus the buildings at the
///         value they were bought for — divided by the shares in issue. It
///         moves only at a close, for exactly two reasons: rent the vault kept
///         and the curve tax paid by people leaving early. Nothing is ever
///         paid out. You cash out by redeeming.
///
///         Three additions to a plain ERC-4626:
///           · a curve on `redeem`: within CURVE_DAYS of your most recent
///             deposit you sell slightly below price, on a straight line from
///             CURVE_BPS to zero, and the difference stays in the vault;
///           · `close`, operator only, at most once per calendar month, which
///             books the month's kept rent, restates the buildings' carrying
///             value, and writes the Roll's hash to the registry in the same
///             transaction — a price cannot be set without a hash, nor a hash
///             without a price;
///           · a redemption queue: a redemption the reserve cannot cover is
///             queued and settled at the next close, at that close's price.
///
///         No borrowing, no upgrade path, no way for the operator to move
///         EURG anywhere but to a redeeming holder.
///
/// @dev    Not audited. This is the demonstration build's reference source.
///         Do not deploy with real money before an independent review.
contract Vault {
    // ------------------------------------------------------------ token ---
    string public constant name = "RENTA Vault Share";
    string public constant symbol = "vRENTA";
    uint8 public immutable decimals;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // ------------------------------------------------------------ vault ---
    IERC20 public immutable asset;            // EURG
    RollRegistry public immutable registry;
    address public immutable operator;         // a multisig; can only close

    uint256 public constant MIN_DEPOSIT = 100e6;   // 100 EURG at 6 decimals — set for the asset's decimals below
    uint256 public constant CURVE_DAYS = 90;
    uint256 public constant CURVE_BPS = 300;       // 3.00% on day one, straight line to 0 on day 90

    uint256 public immutable minDeposit;

    /// @notice The buildings at cost, in asset units. Restated only at a close.
    uint256 public buildingsAtCost;
    /// @notice The last month closed, YYYYMM.
    uint256 public lastClosedMonth;
    /// @notice When each holder last deposited, for the curve.
    mapping(address => uint256) public lastDepositAt;

    struct Queued { address owner; address receiver; uint256 shares; }
    Queued[] public queue;
    uint256 public queueHead;
    uint256 public queuedShares;

    event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);
    event CurveTax(address indexed owner, uint256 assets);
    event Queued_(uint256 indexed index, address indexed owner, uint256 shares);
    event Settled(uint256 indexed index, address indexed owner, uint256 shares, uint256 assets);
    event Closed(uint256 indexed month, uint256 buildingsAtCost, uint256 reserve, uint256 pricePerShare, bytes32 rollHash);

    error NotOperator();
    error BelowMinimum();
    error ZeroShares();
    error InsufficientBalance();
    error InsufficientAllowance();
    error MonthAlreadyClosed();
    error MonthOutOfOrder();
    error TransferFailed();

    constructor(IERC20 asset_, address operator_, uint256 buildingsAtCost_) {
        asset = asset_;
        operator = operator_;
        decimals = asset_.decimals();
        minDeposit = 100 * 10 ** decimals;
        buildingsAtCost = buildingsAtCost_;
        registry = new RollRegistry(address(this));
    }

    // ------------------------------------------------------- accounting ---
    /// @notice EURG in the reserve.
    function reserve() public view returns (uint256) { return asset.balanceOf(address(this)); }

    /// @notice What the vault holds: the reserve plus the buildings at cost.
    function totalAssets() public view returns (uint256) { return reserve() + buildingsAtCost; }

    function convertToShares(uint256 assets) public view returns (uint256) {
        return totalSupply == 0 ? assets : assets * totalSupply / totalAssets();
    }
    function convertToAssets(uint256 shares) public view returns (uint256) {
        return totalSupply == 0 ? shares : shares * totalAssets() / totalSupply;
    }
    /// @notice The price of one whole share, in asset units.
    function pricePerShare() external view returns (uint256) { return convertToAssets(10 ** decimals); }

    // ---------------------------------------------------------- deposit ---
    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        if (assets < minDeposit) revert BelowMinimum();
        shares = convertToShares(assets);
        if (shares == 0) revert ZeroShares();
        if (!asset.transferFrom(msg.sender, address(this), assets)) revert TransferFailed();
        _mint(receiver, shares);
        lastDepositAt[receiver] = block.timestamp;
        emit Deposit(msg.sender, receiver, assets, shares);
    }

    // ----------------------------------------------------------- redeem ---
    /// @notice The curve tax, in basis points, a holder would pay right now.
    function curveBps(address owner) public view returns (uint256) {
        uint256 since = block.timestamp - lastDepositAt[owner];
        if (lastDepositAt[owner] == 0 || since >= CURVE_DAYS * 1 days) return 0;
        return CURVE_BPS * (CURVE_DAYS * 1 days - since) / (CURVE_DAYS * 1 days);
    }

    /// @notice What `shares` would pay out now, after the curve.
    function previewRedeem(uint256 shares, address owner) public view returns (uint256 assets, uint256 tax) {
        uint256 gross = convertToAssets(shares);
        tax = gross * curveBps(owner) / 10_000;
        assets = gross - tax;
    }

    /// @notice Redeem now if the reserve covers it; otherwise queue for the
    ///         next close. Returns the assets paid, or 0 if queued.
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
        if (shares == 0) revert ZeroShares();
        if (msg.sender != owner) _spendAllowance(owner, msg.sender, shares);
        if (balanceOf[owner] < shares) revert InsufficientBalance();

        (uint256 net, uint256 tax) = previewRedeem(shares, owner);
        if (net + 0 > reserve()) {
            // move the shares into escrow here so they cannot be spent twice
            _transfer(owner, address(this), shares);
            queue.push(Queued({ owner: owner, receiver: receiver, shares: shares }));
            queuedShares += shares;
            emit Queued_(queue.length - 1, owner, shares);
            return 0;
        }
        _burn(owner, shares);
        if (tax > 0) emit CurveTax(owner, tax);          // the tax simply stays in the reserve
        if (!asset.transfer(receiver, net)) revert TransferFailed();
        emit Withdraw(msg.sender, receiver, owner, net, shares);
        return net;
    }

    // ------------------------------------------------------------ close ---
    /// @notice The month's close. `kept` is already in the reserve — rent
    ///         arrives in EURG through the month — so the close only restates
    ///         the buildings, publishes the hash, and settles the queue.
    /// @param  month           YYYYMM
    /// @param  buildingsAtCost_ the carrying value after any purchase, sale or
    ///                          annual valuation booked this month
    /// @param  rollHash        SHA-256 of the published Roll file
    function close(uint256 month, uint256 buildingsAtCost_, bytes32 rollHash) external {
        if (msg.sender != operator) revert NotOperator();
        if (month <= lastClosedMonth) revert MonthOutOfOrder();
        if (registry.rollHash(month) != bytes32(0)) revert MonthAlreadyClosed();

        buildingsAtCost = buildingsAtCost_;
        lastClosedMonth = month;
        registry.publish(month, rollHash);

        _settleQueue();

        emit Closed(month, buildingsAtCost, reserve(), convertToAssets(10 ** decimals), rollHash);
    }

    /// @dev Settle queued redemptions in order, at this close's price, as far
    ///      as the reserve reaches. Whatever cannot be paid waits again.
    function _settleQueue() internal {
        while (queueHead < queue.length) {
            Queued storage q = queue[queueHead];
            (uint256 net, uint256 tax) = previewRedeem(q.shares, q.owner);
            if (net > reserve()) break;
            _burn(address(this), q.shares);
            queuedShares -= q.shares;
            if (tax > 0) emit CurveTax(q.owner, tax);
            if (!asset.transfer(q.receiver, net)) revert TransferFailed();
            emit Settled(queueHead, q.owner, q.shares, net);
            emit Withdraw(address(this), q.receiver, q.owner, net, q.shares);
            queueHead++;
        }
    }

    function queueLength() external view returns (uint256) { return queue.length - queueHead; }

    // ------------------------------------------------------------ erc20 ---
    function transfer(address to, uint256 amount) external returns (bool) { _transfer(msg.sender, to, amount); return true; }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount; emit Approval(msg.sender, spender, amount); return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        _spendAllowance(from, msg.sender, amount); _transfer(from, to, amount); return true;
    }
    function _spendAllowance(address owner, address spender, uint256 amount) internal {
        uint256 a = allowance[owner][spender];
        if (a != type(uint256).max) { if (a < amount) revert InsufficientAllowance(); allowance[owner][spender] = a - amount; }
    }
    function _transfer(address from, address to, uint256 amount) internal {
        if (balanceOf[from] < amount) revert InsufficientBalance();
        balanceOf[from] -= amount; balanceOf[to] += amount;
        // a transfer carries the curve with it, so it cannot be dodged by moving shares
        if (lastDepositAt[from] > lastDepositAt[to]) lastDepositAt[to] = lastDepositAt[from];
        emit Transfer(from, to, amount);
    }
    function _mint(address to, uint256 amount) internal { totalSupply += amount; balanceOf[to] += amount; emit Transfer(address(0), to, amount); }
    function _burn(address from, uint256 amount) internal {
        if (balanceOf[from] < amount) revert InsufficientBalance();
        balanceOf[from] -= amount; totalSupply -= amount; emit Transfer(from, address(0), amount);
    }
}
