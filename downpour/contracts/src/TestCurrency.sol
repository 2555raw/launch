// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "solady/tokens/ERC20.sol";

/// @title TestCurrency
/// @notice A stand-in for a currency on test networks: "Test Euro", "Test Yen".
/// @dev Cloned and initialized by the CurrencyDesk, which is the only minter.
/// Anyone can burn their own balance; the desk burns what it takes in on a
/// conversion. On a production deployment the desk lists real stablecoins
/// instead and none of these exist.
contract TestCurrency is ERC20 {
    string private _name;
    string private _symbol;
    uint8 private _decimals;

    /// @notice The desk that mints this currency. Zero until initialized.
    address public desk;

    error AlreadyInitialized();
    error NotDesk();

    constructor() {
        desk = address(0xdead);
    }

    function initialize(string calldata name_, string calldata symbol_, uint8 decimals_) external {
        if (desk != address(0)) revert AlreadyInitialized();
        desk = msg.sender;
        _name = name_;
        _symbol = symbol_;
        _decimals = decimals_;
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != desk) revert NotDesk();
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function name() public view override returns (string memory) {
        return _name;
    }

    function symbol() public view override returns (string memory) {
        return _symbol;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function _givePermit2InfiniteAllowance() internal pure override returns (bool) {
        return false;
    }
}
