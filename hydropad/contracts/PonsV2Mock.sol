// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/* A stand-in for Pons V2, to test Hydropad's side of the integration.
 *
 * Pons lives on Robinhood Chain and nothing in CI can reach it, so the launch
 * path that matters most — the one that spends money — was the only path never
 * exercised end to end. This is that contract's published surface, with the
 * same function signatures, the same struct field order, the same events and
 * the same constant-product curve, deployed on the local node so the browser
 * can walk launch → buy → sell against it.
 *
 * It is not Pons. It graduates into nothing, it has no Uniswap pool behind it,
 * its fees go nowhere. What it does faithfully is the shape of the calls, and
 * the shape of the calls is what Hydropad can get wrong: a struct field in the
 * wrong order or one field short changes the selector, and every launch then
 * reverts with nothing to read. That is the bug this exists to catch.
 *
 * Signatures follow ponsfamily/contractsV2/src/v2. contracts/pons-test.js pins
 * the selector against the canonical signature independently of this file, so
 * a mock that drifted could not quietly make a broken ABI pass.
 */

struct Socials {
    string twitter;
    string telegram;
    string discord;
    string website;
    string farcaster;
}

struct TokenParams {
    string name;
    string symbol;
    string logo;
    string description;
    Socials socials;
    address creatorFeeRecipient;
    uint16 creatorTaxBps;
    bool buybackEnabled;
    bytes32 expectedEconomics;
    bytes32 salt;
}

struct LaunchConfig {
    uint256 supply;
    uint256 curveFeeBps;
    uint256 phantomQuote;
    uint256 graduationThreshold;
    uint24 poolFee;
    int24 tickSpacing;
    bool enabled;
}

struct LaunchedToken {
    address token;
    address curve;
    address deployer;
    address creatorFeeRecipient;
    address pairToken;
    uint256 graduationThreshold;
    uint24 poolFee;
    int24 tickSpacing;
    uint16 creatorTaxBps;
    bool buybackEnabled;
    uint8 phase;
    uint256 sweptQuote;
    uint256 sweptTokens;
    uint256 sweptAt;
    bool exists;
}

/* ------------------------------------------------------------------ token */

contract PonsV2LauncherToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    string public logo;
    string public description;
    address public deployer;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _logo,
        string memory _description,
        address _deployer,
        uint256 _supply,
        address _curve
    ) {
        name = _name;
        symbol = _symbol;
        logo = _logo;
        description = _description;
        deployer = _deployer;
        totalSupply = _supply;
        balanceOf[_curve] = _supply;
        emit Transfer(address(0), _curve, _supply);
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _move(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        require(a >= value, "allowance");
        if (a != type(uint256).max) allowance[from][msg.sender] = a - value;
        _move(from, to, value);
        return true;
    }

    function _move(address from, address to, uint256 value) private {
        require(balanceOf[from] >= value, "balance");
        unchecked { balanceOf[from] -= value; }
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }
}

/* ------------------------------------------------------------------ curve */

contract PonsV2Curve {
    address public token;
    address public pairToken;
    uint256 public graduationThreshold;
    uint256 public curveFeeBps;

    /* The quote side the curve prices against includes an amount nobody ever
       deposited, so the first buyer does not get the supply for dust. Only the
       real part is withdrawable, and only the real part counts toward
       graduation. */
    uint256 public phantomQuote;
    uint256 public realQuoteReserve;
    uint256 public tokenReserve;

    bool public graduated;

    event CurveBuy(
        address indexed buyer, address indexed recipient,
        uint256 quoteIn, uint256 tokensOut, uint256 fee, uint256 tax
    );
    event CurveSell(
        address indexed seller, address indexed recipient,
        uint256 tokensIn, uint256 quoteOut, uint256 fee, uint256 tax
    );

    constructor(uint256 _supply, uint256 _phantomQuote, uint256 _feeBps, uint256 _threshold) {
        tokenReserve = _supply;
        phantomQuote = _phantomQuote;
        curveFeeBps = _feeBps;
        graduationThreshold = _threshold;
    }

    function setToken(address t) external {
        require(token == address(0), "set");
        token = t;
    }

    function getReserves() external view returns (uint256 quoteReserve, uint256 _tokenReserve) {
        return (phantomQuote + realQuoteReserve, tokenReserve);
    }

    function sellableTokens() external view returns (uint256) {
        return tokenReserve;
    }

    function readyToGraduate() external view returns (bool) {
        return realQuoteReserve >= graduationThreshold;
    }

    function buy(uint256 quoteIn, uint256 minTokensOut, address recipient)
        external payable returns (uint256 tokensOut)
    {
        require(!graduated, "graduated");
        require(msg.value == quoteIn && quoteIn > 0, "quote");
        uint256 fee = (quoteIn * curveFeeBps) / 10000;
        uint256 net = quoteIn - fee;

        uint256 q = phantomQuote + realQuoteReserve;
        uint256 k = q * tokenReserve;
        tokensOut = tokenReserve - k / (q + net);
        require(tokensOut >= minTokensOut, "slippage");

        realQuoteReserve += net;
        tokenReserve -= tokensOut;
        PonsV2LauncherToken(token).transfer(recipient, tokensOut);
        emit CurveBuy(msg.sender, recipient, quoteIn, tokensOut, fee, 0);
    }

    function sell(uint256 tokensIn, uint256 minQuoteOut, address recipient)
        external returns (uint256 quoteOut)
    {
        require(!graduated, "graduated");
        require(tokensIn > 0, "tokens");
        PonsV2LauncherToken(token).transferFrom(msg.sender, address(this), tokensIn);

        uint256 q = phantomQuote + realQuoteReserve;
        uint256 k = q * tokenReserve;
        uint256 gross = q - k / (tokenReserve + tokensIn);
        uint256 fee = (gross * curveFeeBps) / 10000;
        quoteOut = gross - fee;
        require(quoteOut >= minQuoteOut, "slippage");
        require(quoteOut <= realQuoteReserve, "reserve");

        realQuoteReserve -= gross;
        tokenReserve += tokensIn;
        (bool ok, ) = recipient.call{ value: quoteOut }("");
        require(ok, "pay");
        emit CurveSell(msg.sender, recipient, tokensIn, quoteOut, fee, 0);
    }

    receive() external payable {}
}

/* ---------------------------------------------------------------- factory */

contract PonsV2LaunchFactory {
    uint256 public launchFee;
    bool public launchEnabled;
    uint256 public maxCreatorTaxBps = 1000;

    address public owner;
    mapping(address => bool) public whitelistedLaunchers;

    LaunchConfig[] private configs;
    mapping(address => LaunchedToken) private launched;

    event TokenLaunched(
        address indexed token, address indexed curve, address indexed deployer,
        address pairToken, uint256 launchConfigId, uint256 graduationThreshold
    );

    constructor(uint256 _launchFee, bool _enabled) {
        owner = msg.sender;
        launchFee = _launchFee;
        launchEnabled = _enabled;
        configs.push(LaunchConfig({
            supply: 800_000_000 ether,
            curveFeeBps: 100,
            phantomQuote: 4.2 ether,
            graduationThreshold: 30 ether,
            poolFee: 10000,
            tickSpacing: 200,
            enabled: true
        }));
    }

    /* The gate the tests flip, to prove the page reads canLaunch(caller) and
       not launchEnabled(): those differ exactly for a whitelisted address
       while the public gate is shut. */
    function setLaunchEnabled(bool v) external { launchEnabled = v; }
    function setWhitelisted(address who, bool v) external { whitelistedLaunchers[who] = v; }

    function canLaunch(address launcher) public view returns (bool) {
        return launchEnabled || whitelistedLaunchers[launcher];
    }

    function launchConfigCount() external view returns (uint256) { return configs.length; }

    function getLaunchConfig(uint256 id) external view returns (LaunchConfig memory) {
        return configs[id];
    }

    /* A digest of the terms a launch was quoted against. The real one covers
       more; what matters here is that it changes when the terms change, so a
       stale quote cannot be signed against new ones. */
    function previewLaunchEconomics(uint256 launchConfigId, address pairToken)
        public view returns (bytes32)
    {
        LaunchConfig memory c = configs[launchConfigId];
        return keccak256(abi.encode(
            c.supply, c.curveFeeBps, c.phantomQuote, c.graduationThreshold, pairToken, launchFee
        ));
    }

    function getLaunchedToken(address token) external view returns (LaunchedToken memory) {
        return launched[token];
    }

    function launchToken(TokenParams calldata params, uint256 launchConfigId, address pairToken)
        external payable returns (address token, address curve)
    {
        require(canLaunch(msg.sender), "PonsV2: launching is closed");
        require(msg.value == launchFee, "PonsV2: wrong launch fee");
        require(params.creatorTaxBps <= maxCreatorTaxBps, "PonsV2: tax too high");

        LaunchConfig memory c = configs[launchConfigId];
        require(c.enabled, "PonsV2: config disabled");
        require(
            params.expectedEconomics == bytes32(0) ||
            params.expectedEconomics == previewLaunchEconomics(launchConfigId, pairToken),
            "PonsV2: terms moved"
        );

        PonsV2Curve cv = new PonsV2Curve(c.supply, c.phantomQuote, c.curveFeeBps, c.graduationThreshold);
        /* The token's address comes from the caller's salt, so two launches
           with the same salt collide — which is the whole reason the field is
           in TokenParams, and the reason leaving it out of the ABI broke every
           launch rather than one. */
        PonsV2LauncherToken t = new PonsV2LauncherToken{ salt: params.salt }(
            params.name, params.symbol, params.logo, params.description,
            msg.sender, c.supply, address(cv)
        );
        cv.setToken(address(t));

        token = address(t);
        curve = address(cv);
        launched[token] = LaunchedToken({
            token: token,
            curve: curve,
            deployer: msg.sender,
            creatorFeeRecipient: params.creatorFeeRecipient,
            pairToken: pairToken,
            graduationThreshold: c.graduationThreshold,
            poolFee: c.poolFee,
            tickSpacing: c.tickSpacing,
            creatorTaxBps: params.creatorTaxBps,
            buybackEnabled: params.buybackEnabled,
            phase: 0,
            sweptQuote: 0,
            sweptTokens: 0,
            sweptAt: 0,
            exists: true
        });

        emit TokenLaunched(token, curve, msg.sender, pairToken, launchConfigId, c.graduationThreshold);
    }
}
