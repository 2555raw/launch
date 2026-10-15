// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*  kuai — coin launchpad on BNB Chain, paired with tokenized restaurant stocks.
 *
 *  Every coin is created paired with a restaurant. The factory keeps a registry
 *  restaurantId => stock token (a tokenized share on BNB Chain, e.g. MCDx for
 *  McDonald's). Buyers pay the raise IN THAT STOCK TOKEN, and at graduation the
 *  raised stock tokens plus 20 % of the coin supply become a PancakeSwap v2
 *  pool COIN/STOCK whose LP tokens are burned. A restaurant with no stock token
 *  registered cannot be used. If the factory owner registers address(0) for a
 *  restaurant, raises for it are paid in BNB and graduate to a COIN/BNB pool.
 *
 *  The 1 % graduation fee goes to `feeTo`. Point it at KuaiStaking (below) and
 *  70 % of every fee is paid in BNB to $KUAI stakers, 30 % buys back $KUAI on
 *  PancakeSwap and burns it.
 *
 *  UNAUDITED. Try the whole flow on BSC testnet (chainId 97) with a test ERC20
 *  registered as the "stock" before touching mainnet (chainId 56).
 */

interface IERC20 {
    function transfer(address to, uint256 v) external returns (bool);
    function transferFrom(address f, address to, uint256 v) external returns (bool);
    function approve(address s, uint256 v) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}
interface IPancakeRouter {
    function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline)
        external payable returns (uint amountToken, uint amountETH, uint liquidity);
    function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline)
        external returns (uint amountA, uint amountB, uint liquidity);
}
interface IPancakeSwap {
    function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts);
    function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts);
}

contract KuaiToken {
    string public name; string public symbol; uint8 public constant decimals = 18; uint256 public totalSupply;
    mapping(address => uint256) public balanceOf; mapping(address => mapping(address => uint256)) public allowance;
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    constructor(string memory _name, string memory _symbol, uint256 _supply, address _to) {
        name = _name; symbol = _symbol; totalSupply = _supply; balanceOf[_to] = _supply; emit Transfer(address(0), _to, _supply);
    }
    function transfer(address to, uint256 v) external returns (bool) { _move(msg.sender, to, v); return true; }
    function approve(address s, uint256 v) external returns (bool) { allowance[msg.sender][s] = v; emit Approval(msg.sender, s, v); return true; }
    function transferFrom(address f, address to, uint256 v) external returns (bool) {
        uint256 a = allowance[f][msg.sender];
        if (a != type(uint256).max) { require(a >= v, "allowance"); allowance[f][msg.sender] = a - v; }
        _move(f, to, v); return true;
    }
    function _move(address f, address to, uint256 v) internal {
        require(to != address(0), "to=0"); uint256 b = balanceOf[f]; require(b >= v, "balance");
        unchecked { balanceOf[f] = b - v; balanceOf[to] += v; } emit Transfer(f, to, v);
    }
}

contract KuaiRaise {
    uint256 public constant SUPPLY = 1_000_000_000e18;
    uint256 public constant POOL_BPS = 2000;   // 20 % of supply to the pool
    uint256 public constant FEE_BPS = 100;     // 1 % of what was raised to the platform

    address public immutable factory; address public immutable creator; address public immutable feeTo;
    IPancakeRouter public immutable router; KuaiToken public immutable token;
    IERC20 public immutable payToken;          // the restaurant's stock token; address(0) means BNB
    string public restaurantId;
    uint256 public immutable target; uint256 public immutable minimum; uint256 public immutable capPerWallet;
    uint256 public immutable openAt; uint256 public immutable closeAt;

    uint256 public raised; uint256 public closedAt; bool public finalized; bool public graduated; uint256 public buyers;
    mapping(address => uint256) public paid; mapping(address => bool) public claimed;

    event Bought(address indexed buyer, uint256 amount, uint256 raised);
    event Finalized(bool graduated, uint256 raised, uint256 liquidityPay, uint256 liquidityTokens);
    event Claimed(address indexed buyer, uint256 tokens);
    event Refunded(address indexed buyer, uint256 amount);

    constructor(address _creator, address _feeTo, address _router, address _payToken, string memory _name, string memory _symbol,
                string memory _restaurantId, uint256 _target, uint256 _durationSeconds) {
        require(_target >= 1e15 && _target <= 1_000_000e18, "target");
        require(_durationSeconds >= 1 hours && _durationSeconds <= 30 days, "duration");
        factory = msg.sender; creator = _creator; feeTo = _feeTo; router = IPancakeRouter(_router); payToken = IERC20(_payToken);
        restaurantId = _restaurantId; target = _target; minimum = _target / 3; capPerWallet = _target / 10;
        openAt = block.timestamp; closeAt = block.timestamp + _durationSeconds;
        token = new KuaiToken(_name, _symbol, SUPPLY, address(this));
    }

    function isOpen() public view returns (bool) { return closedAt == 0 && block.timestamp < closeAt && !finalized; }
    function payInBnb() public view returns (bool) { return address(payToken) == address(0); }

    /* Pay with BNB (only when the restaurant has no stock token registered). */
    function buy() external payable { require(payInBnb(), "pay in stock token"); uint256 accepted = _accept(msg.value);
        uint256 change = msg.value - accepted; if (change > 0) { (bool ok, ) = msg.sender.call{value: change}(""); require(ok, "change"); } }

    /* Pay with the paired stock token: approve this contract first. */
    function buyWith(uint256 amount) external { require(!payInBnb(), "pay in BNB"); uint256 accepted = _accept(amount);
        require(payToken.transferFrom(msg.sender, address(this), accepted), "transferFrom"); }

    function _accept(uint256 amount) internal returns (uint256) {
        require(isOpen(), "closed"); require(amount >= target / 100000, "too small");
        uint256 room = target - raised; uint256 walletRoom = capPerWallet - paid[msg.sender];
        if (amount > walletRoom) amount = walletRoom; if (amount > room) amount = room; require(amount > 0, "cap");
        if (paid[msg.sender] == 0) buyers++;
        paid[msg.sender] += amount; raised += amount;
        if (raised >= target) closedAt = block.timestamp;
        emit Bought(msg.sender, amount, raised);
        return amount;
    }

    /* Anyone can finalize once the raise is closed. */
    function finalize() external {
        require(!finalized, "done"); require(closedAt != 0 || block.timestamp >= closeAt, "open");
        finalized = true; if (closedAt == 0) closedAt = block.timestamp;
        if (raised < minimum) { emit Finalized(false, raised, 0, 0); return; }
        graduated = true;
        uint256 fee = raised * FEE_BPS / 10_000; uint256 lp = raised - fee; uint256 lpTokens = SUPPLY * POOL_BPS / 10_000;
        token.approve(address(router), lpTokens);
        if (payInBnb()) {
            router.addLiquidityETH{value: lp}(address(token), lpTokens, 0, 0, address(0xdead), block.timestamp + 10 minutes);
            if (fee > 0) { (bool ok, ) = feeTo.call{value: fee}(""); require(ok, "fee"); }
        } else {
            payToken.approve(address(router), lp);
            router.addLiquidity(address(token), address(payToken), lpTokens, lp, 0, 0, address(0xdead), block.timestamp + 10 minutes);
            if (fee > 0) require(payToken.transfer(feeTo, fee), "fee");
        }
        emit Finalized(true, raised, lp, lpTokens);
    }

    function claimable(address who) public view returns (uint256) {
        if (!graduated || claimed[who] || raised == 0) return 0;
        return (SUPPLY - SUPPLY * POOL_BPS / 10_000) * paid[who] / raised;
    }
    function claim() external { uint256 t = claimable(msg.sender); require(t > 0, "nothing"); claimed[msg.sender] = true; token.transfer(msg.sender, t); emit Claimed(msg.sender, t); }
    function refund() external {
        require(finalized && !graduated, "no refund"); uint256 v = paid[msg.sender]; require(v > 0, "nothing"); paid[msg.sender] = 0;
        if (payInBnb()) { (bool ok, ) = msg.sender.call{value: v}(""); require(ok, "send"); } else { require(payToken.transfer(msg.sender, v), "send"); }
        emit Refunded(msg.sender, v);
    }

    function info() external view returns (address _token, address _payToken, string memory _name, string memory _symbol, string memory _restaurantId, address _creator,
        uint256 _target, uint256 _minimum, uint256 _cap, uint256 _openAt, uint256 _closeAt, uint256 _raised, uint256 _closedAt, uint256 _buyers, bool _finalized, bool _graduated) {
        return (address(token), address(payToken), token.name(), token.symbol(), restaurantId, creator, target, minimum, capPerWallet, openAt, closeAt, raised, closedAt, buyers, finalized, graduated);
    }
}

contract KuaiFactory {
    address public owner; address public feeTo; address public immutable router;
    address[] public raises;
    mapping(string => address) public stockOf;      // restaurantId => stock token on this chain
    mapping(string => bool) public enabled;         // restaurants that can be paired
    event StockSet(string restaurantId, address stock, bool enabled);
    event CoinCreated(address indexed raise, address indexed token, address indexed creator, string symbol, string restaurantId, address payToken, uint256 target, uint256 closeAt);

    constructor(address _feeTo, address _router) { owner = msg.sender; feeTo = _feeTo; router = _router; }
    modifier onlyOwner() { require(msg.sender == owner, "owner"); _; }
    function transferOwnership(address o) external onlyOwner { owner = o; }
    /* Where the 1 % graduation fee of coins created from now on goes (KuaiStaking). */
    event FeeToSet(address feeTo);
    function setFeeTo(address f) external onlyOwner { require(f != address(0), "zero"); feeTo = f; emit FeeToSet(f); }

    /* Register the stock token a restaurant pairs with (address(0) = pay in BNB). */
    function setStock(string calldata restaurantId, address stock, bool on) external onlyOwner { stockOf[restaurantId] = stock; enabled[restaurantId] = on; emit StockSet(restaurantId, stock, on); }
    function setStocks(string[] calldata ids, address[] calldata stocks) external onlyOwner {
        require(ids.length == stocks.length, "len");
        for (uint256 i = 0; i < ids.length; i++) { stockOf[ids[i]] = stocks[i]; enabled[ids[i]] = true; emit StockSet(ids[i], stocks[i], true); }
    }

    function createCoin(string calldata name, string calldata symbol, string calldata restaurantId, uint256 target, uint256 durationSeconds) external returns (address) {
        require(enabled[restaurantId], "restaurant not pairable");
        require(bytes(symbol).length >= 2 && bytes(symbol).length <= 8, "symbol");
        require(bytes(name).length >= 2 && bytes(name).length <= 32, "name");
        KuaiRaise r = new KuaiRaise(msg.sender, feeTo, router, stockOf[restaurantId], name, symbol, restaurantId, target, durationSeconds);
        raises.push(address(r));
        emit CoinCreated(address(r), address(r.token()), msg.sender, symbol, restaurantId, stockOf[restaurantId], target, r.closeAt());
        return address(r);
    }
    function count() external view returns (uint256) { return raises.length; }
    function all(uint256 from, uint256 n) external view returns (address[] memory out) {
        uint256 len = raises.length; if (from >= len) return out; uint256 to = from + n > len ? len : from + n;
        out = new address[](to - from); for (uint256 i = from; i < to; i++) out[i - from] = raises[i];
    }
}

/*  KuaiStaking — the house coin's staking pool.
 *
 *  Fees arrive as BNB (raises paid in BNB) or as stock tokens (raises paid in a
 *  stock token; the owner converts them with harvest()). Every new BNB is split
 *  when it is accounted (sync): 70 % to $KUAI stakers pro rata, claimable at any
 *  time, 30 % to the buyback pool, which buyback() spends on $KUAI and sends to
 *  the dead address. Until the stake token is set, 100 % goes to the buyback
 *  pool. If nobody is staked, the stakers' 70 % waits and is paid to the first
 *  stakers. No lockup: unstake returns the tokens at once.
 *
 *  harvest() and buyback() swap on PancakeSwap with a caller-supplied minimum,
 *  so only the owner (the keeper) can run them. Everything else is public.
 */
contract KuaiStaking {
    address public owner; IPancakeSwap public immutable router; address public immutable wbnb;
    IERC20 public stakeToken; address public constant DEAD = 0x000000000000000000000000000000000000dEaD;
    uint256 public constant STAKER_BPS = 7000;
    uint256 public totalStaked; uint256 public accPerShare;            // accPerShare scaled by 1e18
    uint256 public rewardReserve; uint256 public buybackPool; uint256 public waiting;   // BNB set aside
    uint256 public lifetimeFees; uint256 public lifetimePaid; uint256 public lifetimeBurned; uint256 public lifetimeBuyback;
    mapping(address => uint256) public stakedOf; mapping(address => uint256) public debtOf; mapping(address => uint256) public owedOf;
    uint256 private locked = 1;
    event Staked(address indexed who, uint256 amount); event Unstaked(address indexed who, uint256 amount);
    event Claimed(address indexed who, uint256 bnb); event Fees(uint256 bnb, uint256 toStakers, uint256 toBuyback);
    event Harvested(address indexed token, uint256 amountIn, uint256 bnbOut); event Buyback(uint256 bnbIn, uint256 burned);
    event StakeTokenSet(address token);

    constructor(address _router, address _wbnb) { owner = msg.sender; router = IPancakeSwap(_router); wbnb = _wbnb; }
    modifier onlyOwner() { require(msg.sender == owner, "owner"); _; }
    modifier nonReentrant() { require(locked == 1, "reentrant"); locked = 2; _; locked = 1; }
    receive() external payable {}
    function transferOwnership(address o) external onlyOwner { owner = o; }
    function setStakeToken(address t) external onlyOwner { require(address(stakeToken) == address(0) && t != address(0), "set"); stakeToken = IERC20(t); emit StakeTokenSet(t); }

    /* BNB in the contract that is not yet split */
    function unaccounted() public view returns (uint256) { uint256 held = rewardReserve + buybackPool + waiting; uint256 b = address(this).balance; return b > held ? b - held : 0; }
    function sync() public {
        uint256 incoming = unaccounted(); if (incoming == 0 && (waiting == 0 || totalStaked == 0)) return;
        uint256 toStakers = address(stakeToken) == address(0) ? 0 : incoming * STAKER_BPS / 10000; uint256 toBuyback = incoming - toStakers;
        lifetimeFees += incoming; buybackPool += toBuyback;
        uint256 pay = toStakers + waiting;
        if (totalStaked > 0) { accPerShare += pay * 1e18 / totalStaked; rewardReserve += pay; waiting = 0; } else waiting = pay;
        if (incoming > 0) emit Fees(incoming, toStakers, toBuyback);
    }
    function _settle(address who) internal { uint256 acc = stakedOf[who] * accPerShare / 1e18; if (acc > debtOf[who]) owedOf[who] += acc - debtOf[who]; }
    function stake(uint256 amount) external nonReentrant {
        require(address(stakeToken) != address(0), "no stake token"); require(amount > 0, "amount");
        sync(); _settle(msg.sender);
        require(stakeToken.transferFrom(msg.sender, address(this), amount), "transfer");
        stakedOf[msg.sender] += amount; totalStaked += amount; debtOf[msg.sender] = stakedOf[msg.sender] * accPerShare / 1e18;
        if (waiting > 0) sync();
        emit Staked(msg.sender, amount);
    }
    function unstake(uint256 amount) external nonReentrant {
        require(amount > 0 && amount <= stakedOf[msg.sender], "amount");
        sync(); _settle(msg.sender);
        stakedOf[msg.sender] -= amount; totalStaked -= amount; debtOf[msg.sender] = stakedOf[msg.sender] * accPerShare / 1e18;
        require(stakeToken.transfer(msg.sender, amount), "transfer");
        emit Unstaked(msg.sender, amount);
    }
    function claim() external nonReentrant {
        sync(); _settle(msg.sender); debtOf[msg.sender] = stakedOf[msg.sender] * accPerShare / 1e18;
        uint256 v = owedOf[msg.sender]; require(v > 0, "nothing"); owedOf[msg.sender] = 0;
        if (v > rewardReserve) v = rewardReserve; rewardReserve -= v; lifetimePaid += v;
        (bool ok, ) = msg.sender.call{value: v}(""); require(ok, "send");
        emit Claimed(msg.sender, v);
    }
    /* BNB claimable by `who`, counting fees that arrived but were not split yet */
    function pendingOf(address who) external view returns (uint256) {
        uint256 acc = accPerShare;
        if (totalStaked > 0 && address(stakeToken) != address(0)) acc += (unaccounted() * STAKER_BPS / 10000 + waiting) * 1e18 / totalStaked;
        uint256 a = stakedOf[who] * acc / 1e18; return owedOf[who] + (a > debtOf[who] ? a - debtOf[who] : 0);
    }
    /* keeper: swap a stock-token fee balance to BNB (path ends in WBNB), then split it */
    function harvest(address[] calldata path, uint256 minOut) external onlyOwner nonReentrant {
        require(path.length >= 2 && path[path.length - 1] == wbnb, "path"); IERC20 t = IERC20(path[0]);
        require(address(t) != address(stakeToken), "stake token"); uint256 amt = t.balanceOf(address(this)); require(amt > 0, "empty");
        uint256 before = address(this).balance; require(t.approve(address(router), amt), "approve");
        router.swapExactTokensForETH(amt, minOut, path, address(this), block.timestamp + 600);
        emit Harvested(address(t), amt, address(this).balance - before); sync();
    }
    /* keeper: spend the buyback pool on $KUAI and send it to the dead address */
    function buyback(uint256 minOut) external onlyOwner nonReentrant {
        require(address(stakeToken) != address(0), "no stake token"); sync(); uint256 v = buybackPool; require(v > 0, "empty"); buybackPool = 0;
        address[] memory path = new address[](2); path[0] = wbnb; path[1] = address(stakeToken);
        uint256[] memory out = router.swapExactETHForTokens{value: v}(minOut, path, DEAD, block.timestamp + 600);
        uint256 burned = out[out.length - 1]; lifetimeBuyback += v; lifetimeBurned += burned; emit Buyback(v, burned);
    }
    function summary() external view returns (address token, uint256 staked, uint256 rewards, uint256 pool, uint256 pending, uint256 fees, uint256 paid, uint256 burned, uint256 waitingStakers) {
        return (address(stakeToken), totalStaked, rewardReserve, buybackPool, unaccounted(), lifetimeFees, lifetimePaid, lifetimeBurned, waiting);
    }
}
