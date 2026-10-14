// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
/* Test doubles for the local EVM run: a stock token and a router that just takes the liquidity. */
interface IERC20M { function transferFrom(address, address, uint256) external returns (bool); function transfer(address, uint256) external returns (bool); function balanceOf(address) external view returns (uint256); }
contract MockStock {
    string public name = "McDonald's xStock"; string public symbol = "MCDx"; uint8 public decimals = 18; uint256 public totalSupply;
    mapping(address => uint256) public balanceOf; mapping(address => mapping(address => uint256)) public allowance;
    function mint(address to, uint256 v) external { balanceOf[to] += v; totalSupply += v; }
    function transfer(address to, uint256 v) external returns (bool) { require(balanceOf[msg.sender] >= v, "bal"); balanceOf[msg.sender] -= v; balanceOf[to] += v; return true; }
    function approve(address s, uint256 v) external returns (bool) { allowance[msg.sender][s] = v; return true; }
    function transferFrom(address f, address to, uint256 v) external returns (bool) { require(allowance[f][msg.sender] >= v, "allow"); require(balanceOf[f] >= v, "bal"); allowance[f][msg.sender] -= v; balanceOf[f] -= v; balanceOf[to] += v; return true; }
}
contract MockRouter {
    uint256 public lastEth; uint256 public lastTokens; address public lastToken; address public lastPair;
    function addLiquidityETH(address token, uint amountTokenDesired, uint, uint, address, uint) external payable returns (uint, uint, uint) {
        require(IERC20M(token).transferFrom(msg.sender, address(this), amountTokenDesired), "pull"); lastEth = msg.value; lastTokens = amountTokenDesired; lastToken = token; return (amountTokenDesired, msg.value, 1);
    }
    function addLiquidity(address tokenA, address tokenB, uint a, uint b, uint, uint, address, uint) external returns (uint, uint, uint) {
        require(IERC20M(tokenA).transferFrom(msg.sender, address(this), a), "pullA"); require(IERC20M(tokenB).transferFrom(msg.sender, address(this), b), "pullB");
        lastTokens = a; lastEth = b; lastToken = tokenA; lastPair = tokenB; return (a, b, 1);
    }
}
