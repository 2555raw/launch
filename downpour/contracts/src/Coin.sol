// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "solady/tokens/ERC20.sol";

/// @title Coin
/// @notice A coin launched on the pad.
/// @dev Every coin is an EIP-1167 clone of one implementation, so all coins run
/// the same code and anyone can check that a coin came from the pad by reading
/// which implementation its 45-byte proxy points at. The whole supply is minted
/// once, to the pad, which puts it in the coin's Uniswap pool; there is no owner,
/// no mint, no pause and no transfer rule of any kind. The coin carries its own
/// metadata (name, description, picture, links) and serves it as contract-level
/// metadata (ERC-7572 `contractURI`), so explorers and terminals can show it.
contract Coin is ERC20 {
    string private _name;
    string private _symbol;
    string private _meta;

    /// @notice The pad that minted this coin. Zero until initialized.
    address public launchpad;

    error AlreadyInitialized();

    constructor() {
        // The implementation is never used as a coin; lock it.
        launchpad = address(0xdead);
    }

    /// @notice Called once by the pad, in the same transaction that clones the coin.
    /// @param meta JSON with at least name, symbol, description and image (a data: URL or https).
    function initialize(string calldata name_, string calldata symbol_, uint256 supply, string calldata meta)
        external
    {
        if (launchpad != address(0)) revert AlreadyInitialized();
        launchpad = msg.sender;
        _name = name_;
        _symbol = symbol_;
        _meta = meta;
        _mint(msg.sender, supply);
    }

    function name() public view override returns (string memory) {
        return _name;
    }

    function symbol() public view override returns (string memory) {
        return _symbol;
    }

    /// @notice The metadata JSON as given at launch.
    function metadata() external view returns (string memory) {
        return _meta;
    }

    /// @notice Contract-level metadata (ERC-7572): the launch JSON as a data URL.
    function contractURI() external view returns (string memory) {
        return string(abi.encodePacked("data:application/json;utf8,", _meta));
    }

    /// @dev No implicit allowances for anyone, Permit2 included.
    function _givePermit2InfiniteAllowance() internal pure override returns (bool) {
        return false;
    }
}
