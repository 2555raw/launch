// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "solady/tokens/ERC20.sol";

/// @title Coin
/// @notice A coin launched on the pad.
/// @dev Every coin is an EIP-1167 clone of one implementation, so all coins run
/// the same code and anyone can check that a coin came from the pad by reading
/// which implementation its 45-byte proxy points at. The whole supply is minted
/// once, to the pad, and there is no owner, no mint and no pause. The one rule:
/// nothing can be sent to the coin's Uniswap pair until the curve sells out, so
/// nobody can open that pool at a price of their own before the pad does.
contract Coin is ERC20 {
    string private _name;
    string private _symbol;

    /// @notice The pad that minted this coin. Zero until initialized.
    address public launchpad;
    /// @notice The coin's Uniswap V2 pair with its currency, where it trades once it graduates.
    address public pair;
    /// @notice True once the curve has sold out and the pool is open.
    bool public graduated;

    error AlreadyInitialized();
    error NotLaunchpad();
    error PoolNotOpen();

    constructor() {
        // The implementation is never used as a coin; lock it.
        launchpad = address(0xdead);
    }

    /// @notice Called once by the pad, in the same transaction that clones the coin.
    function initialize(string calldata name_, string calldata symbol_, uint256 supply, address pair_) external {
        if (launchpad != address(0)) revert AlreadyInitialized();
        launchpad = msg.sender;
        pair = pair_;
        _name = name_;
        _symbol = symbol_;
        _mint(msg.sender, supply);
    }

    /// @notice Called by the pad when the curve sells out, just before it seeds the pool.
    function graduate() external {
        if (msg.sender != launchpad) revert NotLaunchpad();
        graduated = true;
    }

    function name() public view override returns (string memory) {
        return _name;
    }

    function symbol() public view override returns (string memory) {
        return _symbol;
    }

    function _beforeTokenTransfer(address, address to, uint256) internal view override {
        if (to == pair && !graduated) revert PoolNotOpen();
    }

    /// @dev No implicit allowances for anyone, Permit2 included.
    function _givePermit2InfiniteAllowance() internal pure override returns (bool) {
        return false;
    }
}
