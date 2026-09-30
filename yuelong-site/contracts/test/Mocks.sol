// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Test doubles: a stock token with any decimals, and a V2 router/factory pair that really
/// holds the liquidity it receives.
contract MockStock {
    string public name; string public symbol; uint8 public decimals;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    constructor(string memory n, string memory s, uint8 d) { name = n; symbol = s; decimals = d; }
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; totalSupply += amount; emit Transfer(address(0), to, amount); }
    function approve(address sp, uint256 a) external returns (bool) { allowance[msg.sender][sp] = a; emit Approval(msg.sender, sp, a); return true; }
    function transfer(address to, uint256 a) external returns (bool) { _t(msg.sender, to, a); return true; }
    function transferFrom(address f, address to, uint256 a) external returns (bool) {
        uint256 al = allowance[f][msg.sender]; require(al >= a, "allowance"); if (al != type(uint256).max) allowance[f][msg.sender] = al - a; _t(f, to, a); return true;
    }
    function _t(address f, address to, uint256 a) private { require(balanceOf[f] >= a, "balance"); balanceOf[f] -= a; balanceOf[to] += a; emit Transfer(f, to, a); }
}

contract MockPair {
    address public token0; address public token1;
    constructor(address a, address b) { token0 = a; token1 = b; }
}

contract MockV2Factory {
    mapping(address => mapping(address => address)) public getPair;
    function createPair(address a, address b) external returns (address p) {
        p = address(new MockPair(a, b)); getPair[a][b] = p; getPair[b][a] = p;
    }
}

contract MockV2Router {
    MockV2Factory public immutable factory;
    constructor(address f) { factory = MockV2Factory(f); }
    function addLiquidity(address a, address b, uint256 amtA, uint256 amtB, uint256, uint256, address, uint256) external returns (uint256, uint256, uint256) {
        address p = factory.getPair(a, b);
        if (p == address(0)) p = factory.createPair(a, b);
        require(MockStock(a).transferFrom(msg.sender, p, amtA), "a");
        require(MockStock(b).transferFrom(msg.sender, p, amtB), "b");
        return (amtA, amtB, 1e18);
    }
}
