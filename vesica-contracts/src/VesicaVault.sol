// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IOracleGate} from "./interfaces/IOracleGate.sol";

/// @title VesicaVault
/// @notice One vault per stock. Depositors put in USDG and hold shares; the
///         trading fees the position earns are harvested and split 70/20/10.
///         The 70% is not sent anywhere — it stays in the vault, which is what
///         lifts the share price. That is the whole mechanism.
///
/// @dev Three properties this contract is built to hold, and which the test
///      suite exists to prove:
///
///      1. **Withdrawals are never pausable.** The guardian can stop deposits
///         and stop harvests. It cannot stop anyone leaving. A pause that traps
///         depositors' money is indistinguishable from a rug, so the power to
///         do it is simply not here.
///      2. **A stale oracle stops money coming in, never money going out.**
///         Exiting is priced off the vault's own balance, not off a feed, so a
///         dead feed must not become a lock.
///      3. **Rounding always favours the vault, never the caller.** Dust left
///         by the fee split stays with the depositors.
contract VesicaVault is ERC4626, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    /// @notice May pause and unpause deposits. Held by a multisig that can act fast.
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    /// @notice May call harvest. Held by the keeper bot.
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    /// @dev The split, in basis points. Immutable on purpose: the site states
    ///      these numbers as a property of the protocol, so they are not a
    ///      setting an admin can quietly move.
    uint256 public constant BPS = 10_000;
    uint256 public constant BUYBACK_BPS = 2_000; // 20% buys VESICA back and burns it
    uint256 public constant TREASURY_BPS = 1_000; // 10% funds audits, oracles, keepers
    // the remaining 70% stays in the vault and compounds

    /// @notice The most USDG this vault will hold from deposits, in asset units.
    uint256 public cap;

    /// @notice Deposits refuse while this is true. Withdrawals do not.
    bool public depositsPaused;

    /// @notice The freshness check run before accepting a deposit.
    IOracleGate public gate;

    /// @notice Where the 20% goes to be swapped into VESICA and burned.
    address public buyback;

    /// @notice Where the 10% goes.
    address public treasury;

    event CapSet(uint256 previous, uint256 current);
    event GateSet(address indexed previous, address indexed current);
    event BuybackSet(address indexed previous, address indexed current);
    event TreasurySet(address indexed previous, address indexed current);
    event DepositsPaused(address indexed by);
    event DepositsUnpaused(address indexed by);
    event Harvested(
        address indexed keeper, uint256 total, uint256 compounded, uint256 toBuyback, uint256 toTreasury
    );

    error ZeroAddress();
    error DepositsArePaused();
    error NothingToHarvest();

    constructor(
        IERC20 _asset,
        string memory _name,
        string memory _symbol,
        uint256 _cap,
        IOracleGate _gate,
        address _admin,
        address _buyback,
        address _treasury
    ) ERC20(_name, _symbol) ERC4626(_asset) {
        if (
            address(_gate) == address(0) || _admin == address(0) || _buyback == address(0)
                || _treasury == address(0)
        ) revert ZeroAddress();

        cap = _cap;
        gate = _gate;
        buyback = _buyback;
        treasury = _treasury;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);

        emit CapSet(0, _cap);
        emit GateSet(address(0), address(_gate));
        emit BuybackSet(address(0), _buyback);
        emit TreasurySet(address(0), _treasury);
    }

    /* ------------------------------------------------------------------ */
    /*  the inflation attack                                               */
    /* ------------------------------------------------------------------ */

    /// @dev The first depositor into an empty ERC-4626 can donate assets
    ///      straight to the contract to push the share price up before anyone
    ///      else arrives, so the next depositor's shares round to zero and
    ///      their money is absorbed. The virtual-share offset makes that attack
    ///      cost more than it can ever return.
    function _decimalsOffset() internal pure override returns (uint8) {
        return 3;
    }

    /* ------------------------------------------------------------------ */
    /*  limits                                                             */
    /* ------------------------------------------------------------------ */

    /// @inheritdoc ERC4626
    function maxDeposit(address) public view override returns (uint256) {
        if (depositsPaused) return 0;
        uint256 assets = totalAssets();
        if (assets >= cap) return 0;
        return cap - assets;
    }

    /// @inheritdoc ERC4626
    function maxMint(address receiver) public view override returns (uint256) {
        uint256 room = maxDeposit(receiver);
        if (room == 0) return 0;
        // Round the share allowance down so minting exactly maxMint can never
        // pull in more assets than the cap leaves room for.
        return _convertToShares(room, Math.Rounding.Floor);
    }

    /* ------------------------------------------------------------------ */
    /*  deposit and withdraw                                               */
    /* ------------------------------------------------------------------ */

    /// @dev Everything in and out of an ERC-4626 funnels through these two, so
    ///      the gate and the guard sit here rather than on the four externals.
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares)
        internal
        override
        nonReentrant
    {
        if (depositsPaused) revert DepositsArePaused();
        gate.check();
        super._deposit(caller, receiver, assets, shares);
    }

    /// @dev Deliberately not gated and not pausable. See the contract notes.
    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares)
        internal
        override
        nonReentrant
    {
        super._withdraw(caller, receiver, owner, assets, shares);
    }

    /* ------------------------------------------------------------------ */
    /*  fees                                                               */
    /* ------------------------------------------------------------------ */

    /// @notice Bring in `amount` of fee revenue from `from` and split it.
    /// @dev The compounded share is whatever is left after the other two are
    ///      sent, so the rounding dust lands with the depositors rather than
    ///      being stranded or handed to the treasury.
    function harvest(address from, uint256 amount)
        external
        onlyRole(KEEPER_ROLE)
        nonReentrant
        returns (uint256 compounded, uint256 toBuyback, uint256 toTreasury)
    {
        if (depositsPaused) revert DepositsArePaused();
        if (amount == 0) revert NothingToHarvest();
        gate.check();

        IERC20 token = IERC20(asset());
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        // Measure what actually arrived: a fee-on-transfer asset would deliver
        // less than `amount`, and splitting the number we asked for rather than
        // the number we got would pay the other two legs out of depositors' money.
        uint256 received = token.balanceOf(address(this)) - before;
        if (received == 0) revert NothingToHarvest();

        toBuyback = received.mulDiv(BUYBACK_BPS, BPS, Math.Rounding.Floor);
        toTreasury = received.mulDiv(TREASURY_BPS, BPS, Math.Rounding.Floor);
        compounded = received - toBuyback - toTreasury;

        if (toBuyback != 0) token.safeTransfer(buyback, toBuyback);
        if (toTreasury != 0) token.safeTransfer(treasury, toTreasury);
        // `compounded` is already here. Leaving it is the whole point: it raises
        // totalAssets against an unchanged share count, so the share price rises.

        emit Harvested(msg.sender, received, compounded, toBuyback, toTreasury);
    }

    /* ------------------------------------------------------------------ */
    /*  administration                                                     */
    /* ------------------------------------------------------------------ */

    /// @notice Stop new deposits. Withdrawals are unaffected and stay open.
    function pauseDeposits() external onlyRole(GUARDIAN_ROLE) {
        depositsPaused = true;
        emit DepositsPaused(msg.sender);
    }

    /// @dev Unpausing is the admin's call, not the guardian's: a key that can
    ///      only ever stop things is a much smaller thing to lose.
    function unpauseDeposits() external onlyRole(DEFAULT_ADMIN_ROLE) {
        depositsPaused = false;
        emit DepositsUnpaused(msg.sender);
    }

    function setCap(uint256 newCap) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit CapSet(cap, newCap);
        cap = newCap;
    }

    function setGate(IOracleGate newGate) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (address(newGate) == address(0)) revert ZeroAddress();
        emit GateSet(address(gate), address(newGate));
        gate = newGate;
    }

    function setBuyback(address newBuyback) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newBuyback == address(0)) revert ZeroAddress();
        emit BuybackSet(buyback, newBuyback);
        buyback = newBuyback;
    }

    function setTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newTreasury == address(0)) revert ZeroAddress();
        emit TreasurySet(treasury, newTreasury);
        treasury = newTreasury;
    }
}
