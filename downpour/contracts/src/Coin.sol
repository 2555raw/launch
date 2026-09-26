// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "solady/tokens/ERC20.sol";

/// @title Coin
/// @notice A coin launched on the pad.
/// @dev Every coin is an EIP-1167 clone of one implementation, so all coins run
/// the same code and anyone can check that a coin came from the pad by reading
/// which implementation its 45-byte proxy points at. The whole supply is minted
/// once, to the pad, and there is no owner, no mint and no pause.
contract Coin is ERC20 {
    string private _name;
    string private _symbol;

    /// @notice The pad that minted this coin. Zero until initialized.
    address public launchpad;

    error AlreadyInitialized();

    constructor() {
        // The implementation is never used as a coin; lock it.
        launchpad = address(0xdead);
    }

    /// @notice Called once by the pad, in the same transaction that clones the coin.
    function initialize(string calldata name_, string calldata symbol_, uint256 supply) external {
        if (launchpad != address(0)) revert AlreadyInitialized();
        launchpad = msg.sender;
        _name = name_;
        _symbol = symbol_;
        _mint(msg.sender, supply);
    }

    function name() public view override returns (string memory) {
        return _name;
    }

    function symbol() public view override returns (string memory) {
        return _symbol;
    }

    /// @dev No implicit allowances for anyone, Permit2 included.
    function _givePermit2InfiniteAllowance() internal pure override returns (bool) {
        return false;
    }
}
