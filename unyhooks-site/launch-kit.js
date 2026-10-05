/* UnyHooks — the contracts behind "Launch a token" and liquidity locks.

     UnyToken       a plain ERC-20: fixed supply minted once, no owner, no mint,
                    no fees, no blocklist
     LiquidityLock  holds Uniswap V4 positions until a date. Fees can be collected
                    to the owner at any time; the liquidity itself only comes
                    back after the date, which can be pushed later, never sooner
     UnyLaunch      everything in one transaction, from its constructor: creates
                    the token, the launch-protection hook (at an address carrying
                    its permission bits), the token/ETH pool, the full-range
                    position, and the lock; sends the rest of the supply and any
                    unused ETH back to the creator, then announces it all in a
                    Launched event

   The hook itself is the LaunchGuardHook template from builder.js. Every source
   here is compiled in the browser by compile-worker.js and by the checks in
   scripts/ (check-hooks.js, hook-tests/launch.test.js). The token's and the
   lock's runtime code carry no immutables, so every copy has the same code hash:
   public pages use that to tell a real UnyHooks token or lock from a lookalike.

   Loaded as a plain script in the browser (window.UnyLaunchKit) and with
   require() in Node. */

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.UnyLaunchKit = api;
})(typeof self !== 'undefined' ? self : this, () => {
  'use strict';

  // Addresses come in EIP-55 checksummed (ethers.getAddress): Solidity requires it.
  const checksum = (a) => String(a).trim();

  const token = () => `// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title UnyToken
/// @notice A plain ERC-20 made with UnyHooks. The whole supply is minted once, when the
/// @notice token is created. There is no owner, and nobody can mint more, pause transfers,
/// @notice charge a tax or block a wallet.
contract UnyToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    error InsufficientBalance();
    error InsufficientAllowance();
    error ZeroAddress();

    constructor(string memory _name, string memory _symbol, uint256 _supply, address _to) {
        if (_to == address(0)) revert ZeroAddress();
        name = _name;
        symbol = _symbol;
        totalSupply = _supply;
        balanceOf[_to] = _supply;
        emit Transfer(address(0), _to, _supply);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < amount) revert InsufficientAllowance();
            allowance[from][msg.sender] = allowed - amount;
        }
        _move(from, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) private {
        if (to == address(0)) revert ZeroAddress();
        uint256 have = balanceOf[from];
        if (have < amount) revert InsufficientBalance();
        unchecked {
            balanceOf[from] = have - amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
    }
}
`;

  const lock = (positionManager) => `// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";

interface ILockedPositions {
    function ownerOf(uint256 tokenId) external view returns (address);
    function transferFrom(address from, address to, uint256 tokenId) external;
    function getPoolAndPositionInfo(uint256 tokenId) external view returns (PoolKey memory, uint256);
    function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable;
}

/// @title LiquidityLock
/// @notice Holds Uniswap V4 liquidity positions until \`unlockAt\`, made with UnyHooks.
/// @notice While locked, nobody can remove the liquidity, the owner included. Trading fees
/// @notice the positions earn can be sent to the owner at any time. The owner can push the
/// @notice date later, never sooner. After the date, the owner can take the positions back.
contract LiquidityLock {
    using PoolIdLibrary for PoolKey;

    /// @notice Uniswap V4's PositionManager on this chain.
    ILockedPositions public constant POSITIONS = ILockedPositions(${checksum(positionManager)});

    uint256 private constant DECREASE_LIQUIDITY = 0x01;
    uint256 private constant TAKE_PAIR = 0x11;

    /// @notice Receives the fees, and the positions after the date.
    address public owner;
    /// @notice Unix time the positions can be taken back. type(uint256).max: never.
    uint256 public unlockAt;

    event Locked(PoolId indexed poolId, uint256 indexed tokenId, address indexed owner, uint256 unlockAt);
    event Extended(uint256 unlockAt);
    event Withdrawn(uint256 indexed tokenId, address to);

    error NotOwner();
    error NotHeld();
    error OnlyPositions();
    error StillLocked(uint256 unlockAt);
    error NotLater();

    constructor(address _owner, uint256 _unlockAt) {
        owner = _owner;
        unlockAt = _unlockAt;
    }

    /// @notice Positions sent here with safeTransferFrom are announced right away.
    function onERC721Received(address, address, uint256 tokenId, bytes calldata) external returns (bytes4) {
        if (msg.sender != address(POSITIONS)) revert OnlyPositions();
        _announce(tokenId);
        return this.onERC721Received.selector;
    }

    /// @notice For positions minted straight to this lock.
    function announce(uint256 tokenId) external {
        if (POSITIONS.ownerOf(tokenId) != address(this)) revert NotHeld();
        _announce(tokenId);
    }

    /// @notice Sends the fees a position has earned to the owner. Anyone can call it.
    function collectFees(uint256 tokenId) external {
        (PoolKey memory key,) = POSITIONS.getPoolAndPositionInfo(tokenId);
        bytes[] memory params = new bytes[](2);
        // Removing zero liquidity collects the fees and nothing else.
        params[0] = abi.encode(tokenId, uint256(0), uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(key.currency0, key.currency1, owner);
        POSITIONS.modifyLiquidities(abi.encode(abi.encodePacked(uint8(DECREASE_LIQUIDITY), uint8(TAKE_PAIR)), params), block.timestamp);
    }

    /// @notice Gives a position back to the owner, once the date has passed.
    function withdraw(uint256 tokenId) external {
        if (msg.sender != owner) revert NotOwner();
        if (block.timestamp < unlockAt) revert StillLocked(unlockAt);
        POSITIONS.transferFrom(address(this), owner, tokenId);
        emit Withdrawn(tokenId, owner);
    }

    /// @notice Moves the date later.
    function extend(uint256 newUnlockAt) external {
        if (msg.sender != owner) revert NotOwner();
        if (newUnlockAt <= unlockAt) revert NotLater();
        unlockAt = newUnlockAt;
        emit Extended(newUnlockAt);
    }

    function _announce(uint256 tokenId) private {
        (PoolKey memory key,) = POSITIONS.getPoolAndPositionInfo(tokenId);
        emit Locked(key.toId(), tokenId, owner, unlockAt);
    }
}
`;

  const launcher = ({ poolManager, positionManager, permit2 }) => `// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {UnyToken} from "./UnyToken.sol";
import {LiquidityLock} from "./LiquidityLock.sol";
import {LaunchGuardHook} from "./LaunchGuardHook.sol";

interface ILaunchPositions {
    function nextTokenId() external view returns (uint256);
    function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable;
}

interface ILaunchPermit2 {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
}

/// @title UnyLaunch
/// @notice Launches a token in one transaction, made with UnyHooks. Its constructor creates
/// @notice the token, the launch-protection hook, the token/ETH pool on Uniswap V4 and a
/// @notice full-range position with the ETH sent; the position goes to a LiquidityLock (or
/// @notice to the creator when no lock is asked for). The rest of the supply and any
/// @notice unused ETH go back to the creator. Nothing stays in this contract.
contract UnyLaunch {
    using PoolIdLibrary for PoolKey;

    IPoolManager public constant POOL_MANAGER = IPoolManager(${checksum(poolManager)});
    ILaunchPositions public constant POSITIONS = ILaunchPositions(${checksum(positionManager)});
    ILaunchPermit2 public constant PERMIT2 = ILaunchPermit2(${checksum(permit2)});

    struct Params {
        string name;
        string symbol;
        uint256 supply;        // whole supply, 18 decimals
        uint256 poolTokens;    // how much of it goes into the pool
        bytes32 hookSalt;      // makes the hook's address carry its permission bits
        uint24 fee;            // pool fee, hundredths of a bip
        int24 tickSpacing;
        uint160 sqrtPriceX96;  // starting price
        uint128 liquidity;     // full-range liquidity the ETH and poolTokens buy
        uint256 unlockAt;      // 0: no lock, the position goes to the creator
    }

    event Launched(
        address indexed creator, address indexed token, address indexed hook, PoolId poolId, uint256 tokenId, address lock
    );

    error NoLiquidity();

    constructor(Params memory p) payable {
        if (msg.value == 0 || p.poolTokens == 0 || p.liquidity == 0) revert NoLiquidity();

        UnyToken token = new UnyToken(p.name, p.symbol, p.supply, address(this));
        LaunchGuardHook hook = new LaunchGuardHook{salt: p.hookSalt}(POOL_MANAGER, address(token));
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(address(token)),
            fee: p.fee,
            tickSpacing: p.tickSpacing,
            hooks: IHooks(address(hook))
        });
        POOL_MANAGER.initialize(key, p.sqrtPriceX96);

        address lock = p.unlockAt == 0 ? address(0) : address(new LiquidityLock(msg.sender, p.unlockAt));
        uint256 tokenId = _addLiquidity(key, token, p, lock == address(0) ? msg.sender : lock);
        if (lock != address(0)) LiquidityLock(lock).announce(tokenId);

        uint256 rest = token.balanceOf(address(this));
        if (rest > 0) token.transfer(msg.sender, rest);

        emit Launched(msg.sender, address(token), address(hook), key.toId(), tokenId, lock);
    }

    function _addLiquidity(PoolKey memory key, UnyToken token, Params memory p, address to) private returns (uint256 tokenId) {
        token.approve(address(PERMIT2), p.poolTokens);
        PERMIT2.approve(address(token), address(POSITIONS), uint160(p.poolTokens), uint48(block.timestamp));

        // Full range: the lowest and highest ticks the spacing allows.
        int24 upper = (887272 / p.tickSpacing) * p.tickSpacing;
        tokenId = POSITIONS.nextTokenId();

        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(key, -upper, upper, uint256(p.liquidity), uint128(msg.value), uint128(p.poolTokens), to, bytes(""));
        params[1] = abi.encode(key.currency0, key.currency1);
        params[2] = abi.encode(key.currency0, msg.sender); // unused ETH back to the creator
        // MINT_POSITION, SETTLE_PAIR, SWEEP
        POSITIONS.modifyLiquidities{value: msg.value}(abi.encode(hex"020d14", params), block.timestamp);
    }
}
`;

  // Runtime code hashes of every UnyToken and of every LiquidityLock for the
  // PositionManager in config.js. hook-tests/launch.test.js recompiles both and
  // fails if these drift; update them together with the sources above.
  const CODEHASH = {
    token: '0x17378bee02ff223e7b6acb1f12751ec8a3c2b0fc4d45b9b07b8c89ea5be0f5eb',
    lock: '0xa596d2b48da71db474c1634104c5a610997b4faca2bac75a3ba9825c798fa9aa'
  };

  // The compiler input files, keyed the way the launcher imports them.
  const files = (net, hookSource) => ({
    'UnyLaunch.sol': launcher(net),
    'UnyToken.sol': token(),
    'LiquidityLock.sol': lock(net.positionManager),
    'LaunchGuardHook.sol': hookSource
  });

  // Lock lengths offered on the pages, in days. 0 = no lock; Infinity = never unlocks.
  const LOCKS = [
    { days: 0, label: 'No lock' },
    { days: 30, label: '30 days' },
    { days: 90, label: '90 days' },
    { days: 365, label: '1 year' },
    { days: Infinity, label: 'Forever' }
  ];
  const MAX_UINT256 = (1n << 256n) - 1n;
  const unlockAtFor = (days, nowSeconds) => (days === Infinity ? MAX_UINT256 : days > 0 ? BigInt(Math.floor(nowSeconds) + Math.round(days * 86400)) : 0n);

  const PARAMS = 'tuple(string name, string symbol, uint256 supply, uint256 poolTokens, bytes32 hookSalt, uint24 fee, int24 tickSpacing, uint160 sqrtPriceX96, uint128 liquidity, uint256 unlockAt)';
  const LAUNCHED = 'event Launched(address indexed creator, address indexed token, address indexed hook, bytes32 poolId, uint256 tokenId, address lock)';

  // Everything the launch transaction needs, worked out before signing.
  //   ethers, math (pool-math.js), net (checksummed addresses)
  //   creator, nonce: the launcher lands at the creator's next CREATE address,
  //     the token at the launcher's first, so the hook's constructor argument,
  //     and with it the hook's address, are known in advance
  //   launcherBytecode, hookBytecode, flags: from the compiler and builder.js
  //   name, symbol, supply, poolTokens, eth: raw amounts (18 decimals)
  //   fee, tickSpacing, unlockAt
  // Resolves to { data, value, launcher, token, hook, salt, sqrtPriceX96, liquidity }.
  const prepare = async (o, onProgress = () => {}) => {
    const { ethers, math: M } = o;
    if (o.poolTokens <= 0n || o.poolTokens > o.supply) throw new Error('The pool needs part of the supply, and no more than all of it.');
    if (o.eth <= 0n) throw new Error('Add some ETH to pair with the token.');
    const coder = ethers.AbiCoder.defaultAbiCoder();
    const launcher = ethers.getCreateAddress({ from: o.creator, nonce: o.nonce });
    const tokenAddress = ethers.getCreateAddress({ from: launcher, nonce: 1 });
    const hookInit = ethers.concat([o.hookBytecode, coder.encode(['address', 'address'], [o.net.poolManager, tokenAddress])]);
    const initHash = ethers.keccak256(hookInit);

    const want = BigInt(o.flags);
    let salt = null;
    let hook = null;
    for (let i = 0n; i < 5000000n; i++) {
      const s = ethers.zeroPadValue(ethers.toBeHex(i), 32);
      const a = ethers.getCreate2Address(launcher, s, initHash);
      if ((BigInt(a) & 0x3fffn) === want) { salt = s; hook = a; break; }
      if (i % 2000n === 0n) { onProgress(Number(i)); await new Promise((r) => setTimeout(r)); }
    }
    if (!salt) throw new Error('Could not find a hook address. Try again.');

    // ETH is currency0 (address zero sorts first): price = token per ETH, in raw units.
    const sqrtPriceX96 = M.isqrt((o.poolTokens << 192n) / o.eth);
    if (sqrtPriceX96 <= M.MIN_SQRT_PRICE || sqrtPriceX96 >= M.MAX_SQRT_PRICE) throw new Error('That price is outside what Uniswap allows. Change the supply or the ETH amount.');
    const lower = M.sqrtPriceAtTick(M.minUsableTick(o.tickSpacing));
    const upper = M.sqrtPriceAtTick(M.maxUsableTick(o.tickSpacing));
    // A hair under what the amounts allow, so rounding never asks for more than was sent.
    const liquidity = (M.liquidityForAmounts(sqrtPriceX96, lower, upper, o.eth, o.poolTokens) * 99999n) / 100000n;
    if (liquidity === 0n) throw new Error('That is too little to make a pool. Add more ETH or tokens.');

    const params = [o.name, o.symbol, o.supply, o.poolTokens, salt, o.fee, o.tickSpacing, sqrtPriceX96, liquidity, o.unlockAt];
    const data = ethers.concat([o.launcherBytecode, coder.encode([PARAMS], [params])]);
    return { data, value: o.eth, launcher, token: tokenAddress, hook, salt, sqrtPriceX96, liquidity };
  };

  return { token, lock, launcher, files, prepare, PARAMS, LAUNCHED, CODEHASH, LOCKS, MAX_UINT256, unlockAtFor };
});
