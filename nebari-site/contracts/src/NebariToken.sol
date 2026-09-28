// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title NebariToken
/// @notice A fixed-supply ERC20 (one billion, no mint function, burnable) that pays its holders
///         dividends in the asset it is paired with. The factory sends the holders' half
///         of every swap fee here through {distribute}; each holder claims with {claim}.
///
///         Dividend accounting is the classic "magnified dividends per share" scheme:
///         a running total of reward-per-token is kept, and every transfer records a
///         correction so tokens only earn the rewards paid out while they were held.
///         Two addresses never earn: the Uniswap PoolManager (which holds the locked
///         liquidity) and the factory. Their share of each distribution is simply not
///         credited to anybody, so the circulating holders receive the whole amount.
contract NebariToken is ERC20, ERC20Burnable {
    using SafeERC20 for IERC20;

    uint256 public constant SUPPLY = 1_000_000_000e18;
    uint256 private constant MAGNITUDE = 2 ** 128;

    /// @notice The factory that launched this token (the only caller of {distribute}).
    address public immutable factory;
    /// @notice The Uniswap v4 PoolManager, excluded from dividends.
    address public immutable poolManager;
    /// @notice The asset dividends are paid in. address(0) means native ETH.
    address public immutable rewardCurrency;
    /// @notice The wallet that launched the token.
    address public immutable creator;
    /// @notice Off-chain metadata (image, description). Set once at launch.
    string public metadataURI;

    uint256 public magnifiedDividendPerShare;
    mapping(address => int256) private corrections;
    mapping(address => uint256) private withdrawn;
    /// @notice Total rewards ever distributed to holders, in the reward currency.
    uint256 public totalDistributed;

    event DividendsDistributed(uint256 amount, uint256 circulatingSupply);
    event DividendClaimed(address indexed holder, uint256 amount);

    error OnlyFactory();
    error NothingToDistribute();
    error NoCirculatingSupply();
    error NothingToClaim();
    error EthTransferFailed();
    error WrongValue();

    constructor(
        string memory name_,
        string memory symbol_,
        string memory metadataURI_,
        address poolManager_,
        address rewardCurrency_,
        address creator_
    ) ERC20(name_, symbol_) {
        factory = msg.sender;
        poolManager = poolManager_;
        rewardCurrency = rewardCurrency_;
        creator = creator_;
        metadataURI = metadataURI_;
        _mint(msg.sender, SUPPLY);
    }

    // ---------------------------------------------------------------- views

    /// @notice Tokens held by wallets, excluding the locked pool and the factory.
    function circulatingSupply() public view returns (uint256) {
        return totalSupply() - balanceOf(poolManager) - balanceOf(factory);
    }

    /// @notice Everything `account` has earned so far, claimed or not.
    function accumulated(address account) public view returns (uint256) {
        if (account == poolManager || account == factory) return 0;
        int256 magnified = int256(magnifiedDividendPerShare * balanceOf(account)) + corrections[account];
        return uint256(magnified) / MAGNITUDE;
    }

    /// @notice What `account` can claim right now.
    function claimable(address account) public view returns (uint256) {
        return accumulated(account) - withdrawn[account];
    }

    // ------------------------------------------------------------- mutation

    /// @notice Credit `amount` of the reward currency to every circulating holder.
    ///         For ERC20 rewards the factory transfers first, then calls this.
    ///         For ETH rewards the factory sends the value with the call.
    function distribute(uint256 amount) external payable {
        if (msg.sender != factory) revert OnlyFactory();
        if (amount == 0) revert NothingToDistribute();
        if (rewardCurrency == address(0)) {
            if (msg.value != amount) revert WrongValue();
        } else if (msg.value != 0) {
            revert WrongValue();
        }
        uint256 circ = circulatingSupply();
        if (circ == 0) revert NoCirculatingSupply();
        magnifiedDividendPerShare += (amount * MAGNITUDE) / circ;
        totalDistributed += amount;
        emit DividendsDistributed(amount, circ);
    }

    /// @notice Send the caller everything they have earned and not yet claimed.
    function claim() external returns (uint256 amount) {
        amount = claimable(msg.sender);
        if (amount == 0) revert NothingToClaim();
        withdrawn[msg.sender] += amount;
        if (rewardCurrency == address(0)) {
            (bool ok,) = msg.sender.call{value: amount}("");
            if (!ok) revert EthTransferFailed();
        } else {
            IERC20(rewardCurrency).safeTransfer(msg.sender, amount);
        }
        emit DividendClaimed(msg.sender, amount);
    }

    receive() external payable {}

    // ------------------------------------------------------------ internals

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        int256 magnified = int256(magnifiedDividendPerShare * value);
        if (from != address(0)) corrections[from] += magnified;
        if (to != address(0)) corrections[to] -= magnified;
    }
}
