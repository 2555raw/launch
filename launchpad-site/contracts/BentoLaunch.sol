// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*  Bento Launch — coin launchpad on BNB Chain.
 *
 *  BentoFactory.createCoin() deploys a BentoRaise (the sale) and its BentoToken.
 *  Buyers send BNB to the raise while it is open. Reaching the target closes it.
 *  finalize(): if raised >= minimum, part of the BNB and a share of the supply
 *  go into a PancakeSwap pool (LP burned), the rest of the supply is claimable
 *  by buyers pro rata; otherwise every buyer can refund in full.
 *
 *  UNAUDITED. Deploy on BSC testnet (chainId 97) and try the whole flow before
 *  mainnet (chainId 56). Nothing here is upgradeable; parameters are fixed at
 *  creation.
 */

interface IPancakeRouter {
    function factory() external pure returns (address);
    function WETH() external pure returns (address);
    function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline)
        external payable returns (uint amountToken, uint amountETH, uint liquidity);
}

contract BentoToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, uint256 _supply, address _to) {
        name = _name; symbol = _symbol; totalSupply = _supply;
        balanceOf[_to] = _supply;
        emit Transfer(address(0), _to, _supply);
    }
    function transfer(address to, uint256 v) external returns (bool) { _move(msg.sender, to, v); return true; }
    function approve(address s, uint256 v) external returns (bool) { allowance[msg.sender][s] = v; emit Approval(msg.sender, s, v); return true; }
    function transferFrom(address f, address to, uint256 v) external returns (bool) {
        uint256 a = allowance[f][msg.sender];
        if (a != type(uint256).max) { require(a >= v, "allowance"); allowance[f][msg.sender] = a - v; }
        _move(f, to, v); return true;
    }
    function _move(address f, address to, uint256 v) internal {
        require(to != address(0), "to=0");
        uint256 b = balanceOf[f]; require(b >= v, "balance");
        unchecked { balanceOf[f] = b - v; balanceOf[to] += v; }
        emit Transfer(f, to, v);
    }
}

contract BentoRaise {
    uint256 public constant SUPPLY = 1_000_000_000e18;
    uint256 public constant POOL_BPS = 2000;          // 20 % of supply to the pool
    uint256 public constant FEE_BPS = 100;            // 1 % of raised BNB to the platform

    address public immutable factory;
    address public immutable creator;
    address public immutable feeTo;
    IPancakeRouter public immutable router;
    BentoToken public immutable token;
    string public restaurantId;                       // which listed restaurant this coin pairs with
    uint256 public immutable target;
    uint256 public immutable minimum;
    uint256 public immutable capPerWallet;
    uint256 public immutable openAt;
    uint256 public immutable closeAt;

    uint256 public raised;
    uint256 public closedAt;                          // set when the target is hit or finalize() runs
    bool public finalized;
    bool public graduated;
    uint256 public buyers;
    mapping(address => uint256) public paid;
    mapping(address => bool) public claimed;

    event Bought(address indexed buyer, uint256 amount, uint256 raised);
    event Finalized(bool graduated, uint256 raised, uint256 liquidityBnb, uint256 liquidityTokens);
    event Claimed(address indexed buyer, uint256 tokens);
    event Refunded(address indexed buyer, uint256 amount);

    constructor(address _creator, address _feeTo, address _router, string memory _name, string memory _symbol, string memory _restaurantId,
                uint256 _target, uint256 _durationSeconds) {
        require(_target >= 1 ether && _target <= 10_000 ether, "target");
        require(_durationSeconds >= 1 hours && _durationSeconds <= 30 days, "duration");
        factory = msg.sender; creator = _creator; feeTo = _feeTo; router = IPancakeRouter(_router);
        restaurantId = _restaurantId;
        target = _target; minimum = _target / 3; capPerWallet = _target / 10;
        openAt = block.timestamp; closeAt = block.timestamp + _durationSeconds;
        token = new BentoToken(_name, _symbol, SUPPLY, address(this));
    }

    function isOpen() public view returns (bool) { return closedAt == 0 && block.timestamp < closeAt && !finalized; }

    function buy() external payable {
        require(isOpen(), "closed");
        require(msg.value >= 0.001 ether, "min 0.001");
        uint256 amount = msg.value;
        uint256 room = target - raised;
        uint256 walletRoom = capPerWallet - paid[msg.sender];
        if (amount > walletRoom) amount = walletRoom;
        if (amount > room) amount = room;
        require(amount > 0, "cap");
        if (paid[msg.sender] == 0) buyers++;
        paid[msg.sender] += amount; raised += amount;
        if (raised >= target) closedAt = block.timestamp;
        emit Bought(msg.sender, amount, raised);
        uint256 change = msg.value - amount;
        if (change > 0) { (bool ok, ) = msg.sender.call{value: change}(""); require(ok, "change"); }
    }

    /* Anyone can finalize once the raise is closed (target hit or deadline passed). */
    function finalize() external {
        require(!finalized, "done");
        require(closedAt != 0 || block.timestamp >= closeAt, "open");
        finalized = true;
        if (closedAt == 0) closedAt = block.timestamp;
        if (raised < minimum) { emit Finalized(false, raised, 0, 0); return; }   // refunds open
        graduated = true;
        uint256 fee = raised * FEE_BPS / 10_000;
        uint256 lpBnb = raised - fee;
        uint256 lpTokens = SUPPLY * POOL_BPS / 10_000;
        token.approve(address(router), lpTokens);
        router.addLiquidityETH{value: lpBnb}(address(token), lpTokens, 0, 0, address(0xdead), block.timestamp + 10 minutes);
        if (fee > 0) { (bool ok, ) = feeTo.call{value: fee}(""); require(ok, "fee"); }
        emit Finalized(true, raised, lpBnb, lpTokens);
    }

    /* After a graduated raise: buyers claim their share of the 80 % not in the pool. */
    function claimable(address who) public view returns (uint256) {
        if (!graduated || claimed[who] || raised == 0) return 0;
        return (SUPPLY - SUPPLY * POOL_BPS / 10_000) * paid[who] / raised;
    }
    function claim() external {
        uint256 t = claimable(msg.sender);
        require(t > 0, "nothing");
        claimed[msg.sender] = true;
        token.transfer(msg.sender, t);
        emit Claimed(msg.sender, t);
    }

    /* After a failed raise: everyone gets their BNB back in full. */
    function refund() external {
        require(finalized && !graduated, "no refund");
        uint256 v = paid[msg.sender]; require(v > 0, "nothing");
        paid[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: v}(""); require(ok, "send");
        emit Refunded(msg.sender, v);
    }

    /* One call for the UI. */
    function info() external view returns (address _token, string memory _name, string memory _symbol, string memory _restaurantId, address _creator,
        uint256 _target, uint256 _minimum, uint256 _cap, uint256 _openAt, uint256 _closeAt, uint256 _raised, uint256 _closedAt, uint256 _buyers, bool _finalized, bool _graduated) {
        return (address(token), token.name(), token.symbol(), restaurantId, creator, target, minimum, capPerWallet, openAt, closeAt, raised, closedAt, buyers, finalized, graduated);
    }
}

contract BentoFactory {
    address public immutable feeTo;
    address public immutable router;
    address[] public raises;
    mapping(address => address[]) public byCreator;
    event CoinCreated(address indexed raise, address indexed token, address indexed creator, string symbol, string restaurantId, uint256 target, uint256 closeAt);

    constructor(address _feeTo, address _router) { feeTo = _feeTo; router = _router; }

    function createCoin(string calldata name, string calldata symbol, string calldata restaurantId, uint256 target, uint256 durationSeconds) external returns (address) {
        require(bytes(symbol).length >= 2 && bytes(symbol).length <= 8, "symbol");
        require(bytes(name).length >= 2 && bytes(name).length <= 32, "name");
        BentoRaise r = new BentoRaise(msg.sender, feeTo, router, name, symbol, restaurantId, target, durationSeconds);
        raises.push(address(r)); byCreator[msg.sender].push(address(r));
        emit CoinCreated(address(r), address(r.token()), msg.sender, symbol, restaurantId, target, r.closeAt());
        return address(r);
    }
    function count() external view returns (uint256) { return raises.length; }
    function all(uint256 from, uint256 n) external view returns (address[] memory out) {
        uint256 len = raises.length; if (from >= len) return out;
        uint256 to = from + n > len ? len : from + n;
        out = new address[](to - from);
        for (uint256 i = from; i < to; i++) out[i - from] = raises[i];
    }
}
