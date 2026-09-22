// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  TestEURG — a worthless stand-in for the euro token, for testnets.
/// @notice The vault takes an ERC-20 as its asset. On a testnet there is no
///         EURG to take, so this stands in for it: anyone can mint, there is
///         no supply cap, and it is backed by nothing whatsoever.
///
/// @dev    DO NOT DEPLOY THIS ON A CHAIN WHERE ANYONE COULD MISTAKE IT FOR
///         MONEY. `mint` is open to the world on purpose, so a visitor can
///         give themselves a balance and try the vault. That is only safe
///         where the tokens are known to be worthless.
contract TestEURG {
    string public constant name = "Test EURG (worthless)";
    string public constant symbol = "tEURG";
    uint8 public constant decimals = 6;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    error InsufficientBalance();
    error InsufficientAllowance();
    error TooMuch();

    /// @notice Give yourself some. At most 100,000 a go, so one visitor cannot
    ///         make the vault's figures meaningless for everyone else.
    function mint(uint256 amount) external {
        if (amount > 100_000 * 10 ** decimals) revert TooMuch();
        totalSupply += amount;
        balanceOf[msg.sender] += amount;
        emit Transfer(address(0), msg.sender, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a != type(uint256).max) {
            if (a < amount) revert InsufficientAllowance();
            allowance[from][msg.sender] = a - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        uint256 b = balanceOf[from];
        if (b < amount) revert InsufficientBalance();
        unchecked { balanceOf[from] = b - amount; }
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
