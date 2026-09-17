// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal ERC-20. The whole supply is minted to the launcher, which
/// holds it as the curve's token reserve and sells it out as people buy.
contract SpillwayToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    /// @notice Ticker of the water source this token is paired with.
    string public source;
    /// @notice The launcher that minted it and runs its curve.
    address public immutable launcher;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, string memory _source, uint256 _supply) {
        name = _name;
        symbol = _symbol;
        source = _source;
        launcher = msg.sender;
        totalSupply = _supply;
        balanceOf[msg.sender] = _supply;
        emit Transfer(address(0), msg.sender, _supply);
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
            require(allowed >= value, "allowance");
            allowance[from][msg.sender] = allowed - value;
        }
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(to != address(0), "to zero");
        uint256 bal = balanceOf[from];
        require(bal >= value, "balance");
        unchecked {
            balanceOf[from] = bal - value;
            balanceOf[to] += value;
        }
        emit Transfer(from, to, value);
    }
}

/// @title Spillway
/// @notice Launches a token paired to one water source and runs its bonding
/// curve. The curve is a constant product over a virtual ETH reserve and the
/// token reserve the launcher holds, so the first buyer pays the opening price
/// and every later buyer pays more. A fee on each trade accrues to the token's
/// vault, which only its creator can withdraw.
contract Spillway {
    struct Pairing {
        address token;       // the ERC-20
        address creator;     // who launched it
        string source;       // water source ticker, e.g. "MEAD"
        uint128 ethReserve;  // virtual + real ETH on the curve
        uint128 tokenReserve;// tokens the curve still holds
        uint128 raised;      // real ETH taken in, net of fees
        uint128 vault;       // fees owed to the creator
        uint64 launchedAt;
        bool graduated;      // reached the target; the flag stays set
    }

    /// @notice Fee on every buy and sell, in basis points.
    uint256 public constant FEE_BPS = 300;
    /// @notice Virtual ETH the curve starts with. It sets the opening price and
    /// is never withdrawable — only real ETH taken in can leave.
    uint256 public constant VIRTUAL_ETH = 1.2 ether;
    /// @notice Raised amount at which a pairing graduates.
    uint256 public constant TARGET = 4.2 ether;

    address[] public tokens;
    mapping(address => Pairing) public pairings;

    uint256 private lock = 1;

    event Launched(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        string source,
        uint256 supply
    );
    event Traded(
        address indexed token,
        address indexed trader,
        bool isBuy,
        uint256 ethAmount,
        uint256 tokenAmount,
        uint256 fee
    );
    event Graduated(address indexed token, uint256 raised);
    event VaultClaimed(address indexed token, address indexed creator, uint256 amount);

    modifier nonReentrant() {
        require(lock == 1, "reentrant");
        lock = 2;
        _;
        lock = 1;
    }

    /// @notice Launch a token paired with `source`. Any ETH sent buys on the
    /// same transaction, so a creator can take the first position.
    function launch(
        string calldata name,
        string calldata symbol,
        string calldata source,
        uint256 supply
    ) external payable nonReentrant returns (address token) {
        require(supply >= 1e21, "supply too small");
        require(bytes(symbol).length > 0 && bytes(symbol).length <= 12, "symbol");
        require(bytes(source).length > 0 && bytes(source).length <= 12, "source");

        token = address(new SpillwayToken(name, symbol, source, supply));
        pairings[token] = Pairing({
            token: token,
            creator: msg.sender,
            source: source,
            ethReserve: uint128(VIRTUAL_ETH),
            tokenReserve: uint128(supply),
            raised: 0,
            vault: 0,
            launchedAt: uint64(block.timestamp),
            graduated: false
        });
        tokens.push(token);
        emit Launched(token, msg.sender, name, symbol, source, supply);

        if (msg.value > 0) _buy(token, msg.value, 0);
    }

    /// @notice Buy on the curve. `minTokensOut` guards against a price move
    /// between quoting and mining.
    function buy(address token, uint256 minTokensOut) external payable nonReentrant {
        require(msg.value > 0, "no value");
        _buy(token, msg.value, minTokensOut);
    }

    /// @notice Sell back into the curve. Approve the launcher first.
    function sell(address token, uint256 tokenAmount, uint256 minEthOut) external nonReentrant {
        Pairing storage p = pairings[token];
        require(p.token != address(0), "unknown token");
        require(tokenAmount > 0, "no amount");

        uint256 ethOut = quoteSell(token, tokenAmount);
        uint256 fee = (ethOut * FEE_BPS) / 10_000;
        uint256 net = ethOut - fee;
        require(net >= minEthOut, "slippage");
        require(ethOut <= p.raised, "curve is dry");

        p.ethReserve = uint128(uint256(p.ethReserve) - ethOut);
        p.tokenReserve = uint128(uint256(p.tokenReserve) + tokenAmount);
        p.raised = uint128(uint256(p.raised) - ethOut);
        p.vault = uint128(uint256(p.vault) + fee);

        require(SpillwayToken(token).transferFrom(msg.sender, address(this), tokenAmount), "transferFrom");
        emit Traded(token, msg.sender, false, ethOut, tokenAmount, fee);

        (bool ok, ) = msg.sender.call{value: net}("");
        require(ok, "eth send");
    }

    /// @notice Withdraw the fees a token has accrued. Creator only.
    function claimVault(address token) external nonReentrant {
        Pairing storage p = pairings[token];
        require(msg.sender == p.creator, "not creator");
        uint256 amount = p.vault;
        require(amount > 0, "empty");
        p.vault = 0;
        emit VaultClaimed(token, msg.sender, amount);
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "eth send");
    }

    /// @notice Tokens the curve would hand over for `ethIn`, before the fee is
    /// taken off the input.
    function quoteBuy(address token, uint256 ethIn) public view returns (uint256) {
        Pairing storage p = pairings[token];
        require(p.token != address(0), "unknown token");
        uint256 fee = (ethIn * FEE_BPS) / 10_000;
        uint256 net = ethIn - fee;
        uint256 k = uint256(p.ethReserve) * uint256(p.tokenReserve);
        return uint256(p.tokenReserve) - k / (uint256(p.ethReserve) + net);
    }

    /// @notice ETH the curve would give back for `tokenAmount`, before the fee.
    function quoteSell(address token, uint256 tokenAmount) public view returns (uint256) {
        Pairing storage p = pairings[token];
        require(p.token != address(0), "unknown token");
        uint256 k = uint256(p.ethReserve) * uint256(p.tokenReserve);
        return uint256(p.ethReserve) - k / (uint256(p.tokenReserve) + tokenAmount);
    }

    /// @notice Current price in wei per whole token.
    function price(address token) external view returns (uint256) {
        Pairing storage p = pairings[token];
        require(p.token != address(0), "unknown token");
        return (uint256(p.ethReserve) * 1e18) / uint256(p.tokenReserve);
    }

    function pairingCount() external view returns (uint256) {
        return tokens.length;
    }

    /// @notice Pairings newest first, for the launches table.
    function listPairings(uint256 offset, uint256 limit) external view returns (Pairing[] memory out) {
        uint256 n = tokens.length;
        if (offset >= n) return new Pairing[](0);
        uint256 count = n - offset;
        if (count > limit) count = limit;
        out = new Pairing[](count);
        for (uint256 i = 0; i < count; i++) {
            out[i] = pairings[tokens[n - 1 - offset - i]];
        }
    }

    function _buy(address token, uint256 ethIn, uint256 minTokensOut) internal {
        Pairing storage p = pairings[token];
        require(p.token != address(0), "unknown token");

        uint256 fee = (ethIn * FEE_BPS) / 10_000;
        uint256 net = ethIn - fee;
        uint256 k = uint256(p.ethReserve) * uint256(p.tokenReserve);
        uint256 tokensOut = uint256(p.tokenReserve) - k / (uint256(p.ethReserve) + net);
        require(tokensOut > 0, "dust");
        require(tokensOut >= minTokensOut, "slippage");
        require(tokensOut < uint256(p.tokenReserve), "curve empty");

        p.ethReserve = uint128(uint256(p.ethReserve) + net);
        p.tokenReserve = uint128(uint256(p.tokenReserve) - tokensOut);
        p.raised = uint128(uint256(p.raised) + net);
        p.vault = uint128(uint256(p.vault) + fee);

        require(SpillwayToken(token).transfer(msg.sender, tokensOut), "transfer");
        emit Traded(token, msg.sender, true, ethIn, tokensOut, fee);

        if (!p.graduated && uint256(p.raised) >= TARGET) {
            p.graduated = true;
            emit Graduated(token, p.raised);
        }
    }
}
