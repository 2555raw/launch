// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title VelaToken
/// @notice Plain fixed-supply ERC-20 that Vela deploys on EVM chains.
///         The whole supply is minted to the deployer. No owner, no mint, no tax,
///         no blacklist: once deployed, nobody (including Vela) can change it.
contract VelaToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory name_, string memory symbol_, uint256 supply_) {
        name = name_;
        symbol = symbol_;
        totalSupply = supply_;
        balanceOf[msg.sender] = supply_;
        emit Transfer(address(0), msg.sender, supply_);
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= value, "VelaToken: allowance");
            unchecked { allowance[from][msg.sender] = allowed - value; }
        }
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(to != address(0), "VelaToken: zero address");
        uint256 bal = balanceOf[from];
        require(bal >= value, "VelaToken: balance");
        unchecked {
            balanceOf[from] = bal - value;
            balanceOf[to] += value; // cannot overflow: the sum of balances is totalSupply
        }
        emit Transfer(from, to, value);
    }
}
