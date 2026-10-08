// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title LaunchToken
 * @notice Minimal, dependency-free ERC-20 used by the Launch launchpad on Robinhood Chain.
 *         The full supply is minted to the creator at deployment. Minting can be permanently
 *         disabled by the owner (fixed supply). Includes burn and EIP-2612-free simplicity.
 */
contract LaunchToken {
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public totalSupply;
    address public owner;
    bool public mintingDisabled;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event MintingDisabled();

    error NotOwner();
    error MintingIsDisabled();
    error InsufficientBalance();
    error InsufficientAllowance();
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(string memory name_, string memory symbol_, uint8 decimals_, uint256 initialSupply_, address owner_, bool fixedSupply_) {
        if (owner_ == address(0)) revert ZeroAddress();
        name = name_;
        symbol = symbol_;
        decimals = decimals_;
        owner = owner_;
        emit OwnershipTransferred(address(0), owner_);
        _mint(owner_, initialSupply_);
        if (fixedSupply_) {
            mintingDisabled = true;
            emit MintingDisabled();
        }
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
            if (allowed < value) revert InsufficientAllowance();
            allowance[from][msg.sender] = allowed - value;
        }
        _transfer(from, to, value);
        return true;
    }

    function burn(uint256 value) external {
        if (balanceOf[msg.sender] < value) revert InsufficientBalance();
        balanceOf[msg.sender] -= value;
        totalSupply -= value;
        emit Transfer(msg.sender, address(0), value);
    }

    function mint(address to, uint256 value) external onlyOwner {
        if (mintingDisabled) revert MintingIsDisabled();
        _mint(to, value);
    }

    function disableMinting() external onlyOwner {
        mintingDisabled = true;
        emit MintingDisabled();
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function _mint(address to, uint256 value) internal {
        if (to == address(0)) revert ZeroAddress();
        totalSupply += value;
        balanceOf[to] += value;
        emit Transfer(address(0), to, value);
    }

    function _transfer(address from, address to, uint256 value) internal {
        if (to == address(0)) revert ZeroAddress();
        uint256 bal = balanceOf[from];
        if (bal < value) revert InsufficientBalance();
        balanceOf[from] = bal - value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }
}
