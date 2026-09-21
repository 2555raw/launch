// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title LilyPadToken
/// @notice The coin. A plain ERC20 with 18 decimals whose whole supply is minted once, in the
///         constructor, to its bonding curve. No owner, no mint, no pause, no blacklist, no tax.
contract LilyPadToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public immutable totalSupply;
    /// @notice The curve this coin was born on. Informational; the token has no privileged caller.
    address public immutable curve;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    error InsufficientBalance();
    error InsufficientAllowance();
    error ZeroAddress();

    constructor(string memory name_, string memory symbol_, uint256 supply_, address curve_) {
        if (curve_ == address(0)) revert ZeroAddress();
        name = name_;
        symbol = symbol_;
        totalSupply = supply_;
        curve = curve_;
        balanceOf[curve_] = supply_;
        emit Transfer(address(0), curve_, supply_);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < amount) revert InsufficientAllowance();
            unchecked { allowance[from][msg.sender] = allowed - amount; }
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) private {
        if (to == address(0)) revert ZeroAddress();
        uint256 bal = balanceOf[from];
        if (bal < amount) revert InsufficientBalance();
        unchecked { balanceOf[from] = bal - amount; }
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
