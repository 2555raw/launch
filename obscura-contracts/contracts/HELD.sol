// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title HELD (placeholder name and ticker)
/// @notice Fixed-supply ERC-20 with a buy fee. When tokens leave an address the owner has
///         marked as an AMM pair (a buy), `feeBps` of the amount is taken in HELD:
///         `burnShareBps` of the fee is burned and the rest goes to `proverPool`.
///         Sells and wallet-to-wallet transfers pay no fee.
/// @dev    There is no mint function after the constructor, no blacklist and no pause.
///         NOT AUDITED.
contract HELD is ERC20, Ownable2Step {
    /// @notice Hard cap on the buy fee: 100 bps = 1%. Cannot be changed by anyone.
    uint16 public constant MAX_FEE_BPS = 100;
    /// @notice Basis-point denominator (100%).
    uint16 public constant BPS = 10_000;

    /// @notice Current buy fee in basis points of the bought amount (<= MAX_FEE_BPS).
    uint16 public feeBps;
    /// @notice Share of each fee that is burned, in basis points of the fee (<= 10_000).
    uint16 public burnShareBps;
    /// @notice Receives the non-burned part of each fee.
    address public proverPool;

    /// @notice Addresses treated as AMM pairs. Transfers FROM a pair are buys.
    mapping(address => bool) public isPair;
    /// @notice Addresses for which no fee is taken (as sender or recipient).
    mapping(address => bool) public isFeeExempt;

    event FeeBpsUpdated(uint16 previousBps, uint16 newBps);
    event BurnShareBpsUpdated(uint16 previousBps, uint16 newBps);
    event ProverPoolUpdated(address indexed previousPool, address indexed newPool);
    event PairUpdated(address indexed pair, bool isPair);
    event FeeExemptUpdated(address indexed account, bool exempt);
    event BuyFeeTaken(address indexed pair, address indexed buyer, uint256 fee, uint256 burned, uint256 toProverPool);

    error FeeAboveCap(uint16 requested, uint16 cap);
    error BurnShareAboveMax(uint16 requested);
    error ZeroAddress();

    /// @param name_          Token name (placeholder until the owner picks one).
    /// @param symbol_        Token symbol.
    /// @param initialSupply_ Total supply in the smallest unit (18 decimals), minted once to the deployer.
    /// @param feeBps_        Initial buy fee in bps (<= MAX_FEE_BPS). Proposal: 30 (0.30%).
    /// @param burnShareBps_  Share of the fee burned, in bps of the fee (<= 10_000). Proposal: 8000 (80%).
    /// @param proverPool_    Recipient of the non-burned share. Must be non-zero.
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply_,
        uint16 feeBps_,
        uint16 burnShareBps_,
        address proverPool_
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        _setFeeBps(feeBps_);
        _setBurnShareBps(burnShareBps_);
        _setProverPool(proverPool_);
        _mint(msg.sender, initialSupply_);
    }

    // ---------------------------------------------------------------- owner settings

    /// @notice Set the buy fee. Any value from 0 up to MAX_FEE_BPS; never above the cap.
    function setFeeBps(uint16 newFeeBps) external onlyOwner {
        _setFeeBps(newFeeBps);
    }

    /// @notice Set the share of each fee that is burned (0..10_000 bps of the fee).
    function setBurnShareBps(uint16 newBurnShareBps) external onlyOwner {
        _setBurnShareBps(newBurnShareBps);
    }

    /// @notice Set the address that receives the non-burned part of each fee.
    function setProverPool(address newProverPool) external onlyOwner {
        _setProverPool(newProverPool);
    }

    /// @notice Mark or unmark an AMM pair. Transfers out of a pair are charged the buy fee.
    function setPair(address pair, bool value) external onlyOwner {
        if (pair == address(0)) revert ZeroAddress();
        isPair[pair] = value;
        emit PairUpdated(pair, value);
    }

    /// @notice Exempt or un-exempt an address from the buy fee.
    function setFeeExempt(address account, bool exempt) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        isFeeExempt[account] = exempt;
        emit FeeExemptUpdated(account, exempt);
    }

    function _setFeeBps(uint16 newFeeBps) private {
        if (newFeeBps > MAX_FEE_BPS) revert FeeAboveCap(newFeeBps, MAX_FEE_BPS);
        emit FeeBpsUpdated(feeBps, newFeeBps);
        feeBps = newFeeBps;
    }

    function _setBurnShareBps(uint16 newBurnShareBps) private {
        if (newBurnShareBps > BPS) revert BurnShareAboveMax(newBurnShareBps);
        emit BurnShareBpsUpdated(burnShareBps, newBurnShareBps);
        burnShareBps = newBurnShareBps;
    }

    function _setProverPool(address newProverPool) private {
        if (newProverPool == address(0)) revert ZeroAddress();
        emit ProverPoolUpdated(proverPool, newProverPool);
        proverPool = newProverPool;
    }

    // ---------------------------------------------------------------- views

    /// @notice Preview the fee split for a buy of `amount` at the current settings.
    /// @return fee      Total fee taken (rounded down).
    /// @return burned   Part of the fee burned (rounded down).
    /// @return toPool   Part of the fee sent to the prover pool (fee - burned).
    function previewBuyFee(uint256 amount) public view returns (uint256 fee, uint256 burned, uint256 toPool) {
        fee = (amount * feeBps) / BPS;
        burned = (fee * burnShareBps) / BPS;
        toPool = fee - burned;
    }

    // ---------------------------------------------------------------- transfer hook

    function _update(address from, address to, uint256 value) internal override {
        // Mints/burns (from or to zero), non-pair senders and exempt parties pay no fee.
        if (
            from == address(0) || to == address(0) || !isPair[from] || feeBps == 0 || isFeeExempt[from]
                || isFeeExempt[to]
        ) {
            super._update(from, to, value);
            return;
        }

        (uint256 fee, uint256 burned, uint256 toPool) = previewBuyFee(value);
        if (fee == 0) {
            super._update(from, to, value);
            return;
        }

        // All three legs debit `from` (the pair), so the pair's balance falls by exactly `value`.
        if (burned != 0) super._update(from, address(0), burned); // burn: lowers totalSupply
        if (toPool != 0) super._update(from, proverPool, toPool);
        super._update(from, to, value - fee);

        emit BuyFeeTaken(from, to, fee, burned, toPool);
    }
}
