/* UnyHooks builder — the part that turns a request into a hook.

   Two pieces, no DOM:
     understand(text)       reads a plain-language request and picks a recipe
                            and its settings (rules, not AI: it looks for
                            keywords, percentages, addresses, times, amounts)
     generate(recipe, s)    writes the Solidity for that recipe and settings

   Every template is checked by scripts/check-hooks.js, which compiles it
   against @uniswap/v4-core and @uniswap/v4-periphery with solc. Run it after
   touching anything below.

   Loaded as a plain script in the browser (window.UnyBuilder) and with
   require() in Node (module.exports). */

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.UnyBuilder = api;
})(typeof self !== 'undefined' ? self : this, () => {
  'use strict';

  /* ---------- the recipes and their settings ---------- */

  const RECIPES = {
    fee: {
      title: 'Fee on every swap',
      contract: 'SwapFeeHook',
      blurb: 'A cut of every trade goes to your wallet or a treasury.',
      fields: [
        { key: 'feePercent', label: 'Fee per swap', unit: '%', type: 'number', min: 0.01, max: 10, step: 0.01, value: 1 },
        { key: 'recipient', label: 'Wallet that receives the fee', type: 'address', value: '' }
      ]
    },
    dynamic: {
      title: 'Dynamic fees',
      contract: 'DynamicFeeHook',
      blurb: 'Higher fees when the price moves fast, lower when it is calm.',
      fields: [
        { key: 'floorPercent', label: 'Lowest fee', unit: '%', type: 'number', min: 0.01, max: 10, step: 0.01, value: 0.05 },
        { key: 'ceilingPercent', label: 'Highest fee', unit: '%', type: 'number', min: 0.01, max: 10, step: 0.01, value: 1 },
        { key: 'fullMovePercent', label: 'Price move that reaches the highest fee', unit: '%', type: 'number', min: 0.1, max: 50, step: 0.1, value: 2 },
        { key: 'windowMinutes', label: 'Measured over', unit: 'min', type: 'number', min: 1, max: 1440, step: 1, value: 5 }
      ]
    },
    launch: {
      title: 'Launch protection',
      contract: 'LaunchGuardHook',
      blurb: 'Caps buys and slows down snipers during a token\'s first hours.',
      fields: [
        { key: 'token', label: 'Your token\'s address', type: 'address', value: '' },
        { key: 'windowMinutes', label: 'Protection lasts', unit: 'min', type: 'number', min: 1, max: 10080, step: 1, value: 60 },
        { key: 'maxBuy', label: 'Biggest buy allowed', unit: 'ETH', type: 'number', min: 0.000001, max: 1e9, step: 0.01, value: 0.5 },
        { key: 'cooldownSeconds', label: 'Wait between buys, per wallet', unit: 's', type: 'number', min: 0, max: 86400, step: 1, value: 30 },
        { key: 'pairDecimals', label: 'Decimals of the token you pay with', type: 'number', min: 0, max: 36, step: 1, value: 18, advanced: true }
      ]
    },
    hours: {
      title: 'Trading hours',
      contract: 'TradingHoursHook',
      blurb: 'The pool only trades inside a daily window, in UTC.',
      fields: [
        { key: 'open', label: 'Opens at (UTC)', type: 'time', value: '13:30' },
        { key: 'close', label: 'Closes at (UTC)', type: 'time', value: '20:00' },
        { key: 'weekdaysOnly', label: 'Monday to Friday only', type: 'checkbox', value: true }
      ]
    }
  };

  const defaults = (recipe) => Object.fromEntries(RECIPES[recipe].fields.map((f) => [f.key, f.value]));

  /* ---------- validation ---------- */

  const isAddress = (v) => /^0x[0-9a-fA-F]{40}$/.test(String(v || '').trim());
  const isTime = (v) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(String(v || ''));

  // Problems that stop the hook from being usable, in words a person can act on.
  const problems = (recipe, s) => {
    const out = [];
    const num = (k) => Number(s[k]);
    const field = (k) => RECIPES[recipe].fields.find((f) => f.key === k);
    const range = (k) => {
      const f = field(k);
      const v = num(k);
      if (!Number.isFinite(v)) return out.push(`${f.label} needs a number.`);
      if (v < f.min || v > f.max) out.push(`${f.label} must be between ${f.min} and ${f.max}${f.unit ? ' ' + f.unit : ''}.`);
    };
    if (recipe === 'fee') {
      range('feePercent');
      if (!isAddress(s.recipient)) out.push('Add the wallet that receives the fee (0x followed by 40 characters).');
    }
    if (recipe === 'dynamic') {
      ['floorPercent', 'ceilingPercent', 'fullMovePercent', 'windowMinutes'].forEach(range);
      if (num('floorPercent') > num('ceilingPercent')) out.push('The lowest fee must not be above the highest fee.');
    }
    if (recipe === 'launch') {
      if (!isAddress(s.token)) out.push('Add your token\'s address (0x followed by 40 characters).');
      ['windowMinutes', 'maxBuy', 'cooldownSeconds', 'pairDecimals'].forEach(range);
    }
    if (recipe === 'hours') {
      if (!isTime(s.open)) out.push('Opening time must look like 13:30.');
      if (!isTime(s.close)) out.push('Closing time must look like 20:00.');
      if (isTime(s.open) && s.open === s.close) out.push('Opening and closing times must differ.');
    }
    return out;
  };

  /* ---------- number helpers ---------- */

  // Percent to hundredths of a bip, the unit Uniswap V4 fees use (1% = 10000).
  const pips = (pct) => Math.round(Number(pct) * 10000);
  // Percent to basis points (1% = 100).
  const bps = (pct) => Math.round(Number(pct) * 100);
  // 1% price move is about 100 ticks (1.0001^100 ≈ 1.01).
  const ticksFor = (pct) => Math.max(1, Math.round(Math.log(1 + Number(pct) / 100) / Math.log(1.0001)));

  // "0.5" with 18 decimals -> "500000000000000000", exactly, without floats.
  const toUnits = (amount, decimals) => {
    const [whole, frac = ''] = String(amount).trim().split('.');
    const d = Number(decimals);
    const padded = (frac + '0'.repeat(d)).slice(0, d);
    const digits = (whole.replace(/^0+/, '') + padded).replace(/^0+/, '');
    return digits || '0';
  };
  const group = (digits) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '_');
  const minutesOf = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const pctText = (p) => `${Number(p)}%`;

  /* ---------- permissions and address flags ---------- */

  const FLAGS = {
    beforeInitialize: 1 << 13, afterInitialize: 1 << 12,
    beforeAddLiquidity: 1 << 11, afterAddLiquidity: 1 << 10,
    beforeRemoveLiquidity: 1 << 9, afterRemoveLiquidity: 1 << 8,
    beforeSwap: 1 << 7, afterSwap: 1 << 6,
    beforeDonate: 1 << 5, afterDonate: 1 << 4,
    beforeSwapReturnDelta: 1 << 3, afterSwapReturnDelta: 1 << 2,
    afterAddLiquidityReturnDelta: 1 << 1, afterRemoveLiquidityReturnDelta: 1 << 0
  };
  const PERMS = {
    fee: ['afterSwap', 'afterSwapReturnDelta'],
    dynamic: ['afterInitialize', 'beforeSwap'],
    launch: ['afterInitialize', 'beforeSwap'],
    hours: ['beforeSwap']
  };

  const permissionsBlock = (on) => {
    const lines = Object.keys(FLAGS).map((k) => `            ${k}: ${on.includes(k) ? 'true' : 'false'}`);
    return `    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
${lines.join(',\n')}
        });
    }`;
  };

  const flagsFor = (recipe) => PERMS[recipe].reduce((acc, k) => acc | FLAGS[k], 0);

  /* ---------- templates ---------- */

  const HEADER = (title, lines) => `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title ${title}
${lines.map((l) => `/// ${l}`).join('\n')}
/// @dev Written by UnyHooks. Not audited: have it reviewed before it holds real funds.`;

  const TEMPLATES = {
    fee: (s) => {
      const fee = bps(s.feePercent);
      return `${HEADER('SwapFeeHook', [
        `@notice Takes ${pctText(s.feePercent)} of every swap and sends it to \`recipient\`.`,
        '@notice The fee comes out of the side the trader did not fix: the output of an',
        '@notice exact-input swap, or the input of an exact-output swap.'
      ])}

import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {SafeCast} from "@uniswap/v4-core/src/libraries/SafeCast.sol";

contract SwapFeeHook is BaseHook {
    using SafeCast for uint256;

    /// @notice Fee in basis points: 100 = 1%.
    uint256 public constant FEE_BPS = ${fee};

    /// @notice Where every fee goes. Set once, at deploy, and never changes.
    /// If this is a contract it must accept ETH, or swaps that pay in ETH revert.
    address public immutable recipient;

    error ZeroRecipient();

    constructor(IPoolManager _poolManager, address _recipient) BaseHook(_poolManager) {
        if (_recipient == address(0)) revert ZeroRecipient();
        recipient = _recipient;
    }

${permissionsBlock(PERMS.fee)}

    function _afterSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata
    ) internal override returns (bytes4, int128) {
        // amountSpecified < 0 means exact input.
        bool specifiedIs0 = (params.amountSpecified < 0) == params.zeroForOne;
        (Currency feeCurrency, int128 amount) =
            specifiedIs0 ? (key.currency1, delta.amount1()) : (key.currency0, delta.amount0());
        if (amount < 0) amount = -amount;

        uint256 fee = uint256(uint128(amount)) * FEE_BPS / 10_000;
        if (fee == 0) return (BaseHook.afterSwap.selector, 0);

        poolManager.take(feeCurrency, recipient, fee);
        return (BaseHook.afterSwap.selector, fee.toInt128());
    }
}
`;
    },

    dynamic: (s) => {
      const lo = pips(s.floorPercent);
      const hi = pips(s.ceilingPercent);
      const ticks = ticksFor(s.fullMovePercent);
      const win = Math.round(Number(s.windowMinutes));
      return `${HEADER('DynamicFeeHook', [
        `@notice Charges between ${pctText(s.floorPercent)} and ${pctText(s.ceilingPercent)} per swap.`,
        `@notice The fee climbs with how far the price has moved in the last ${win} minute${win === 1 ? '' : 's'}`,
        `@notice and reaches the top at a ${pctText(s.fullMovePercent)} move.`,
        '@notice Create the pool with fee = LPFeeLibrary.DYNAMIC_FEE_FLAG (0x800000).'
      ])}

import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";

contract DynamicFeeHook is BaseHook {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    /// @notice Fees are in hundredths of a bip: 10_000 = 1%.
    uint24 public constant MIN_FEE = ${lo};
    uint24 public constant MAX_FEE = ${hi};

    /// @notice A move of this many ticks or more charges MAX_FEE (${pctText(s.fullMovePercent)} of price).
    uint256 public constant FULL_MOVE_TICKS = ${ticks};

    /// @notice How often the reference price is reset.
    uint256 public constant WINDOW = ${win} minutes;

    struct Anchor {
        int24 tick;
        uint64 setAt;
    }

    /// @notice The price each pool is measured against, as a tick.
    mapping(PoolId => Anchor) public anchors;

    error MustUseDynamicFee();

    constructor(IPoolManager _poolManager) BaseHook(_poolManager) {}

${permissionsBlock(PERMS.dynamic)}

    function _afterInitialize(address, PoolKey calldata key, uint160, int24 tick)
        internal
        override
        returns (bytes4)
    {
        if (!LPFeeLibrary.isDynamicFee(key.fee)) revert MustUseDynamicFee();
        anchors[key.toId()] = Anchor(tick, uint64(block.timestamp));
        return BaseHook.afterInitialize.selector;
    }

    function _beforeSwap(address, PoolKey calldata key, SwapParams calldata, bytes calldata)
        internal
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        PoolId id = key.toId();
        (, int24 tick,,) = poolManager.getSlot0(id);
        Anchor storage anchor = anchors[id];

        uint24 fee = feeForMove(tick > anchor.tick ? tick - anchor.tick : anchor.tick - tick);

        if (block.timestamp >= uint256(anchor.setAt) + WINDOW) {
            anchor.tick = tick;
            anchor.setAt = uint64(block.timestamp);
        }

        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    /// @notice The fee for a price move of \`moved\` ticks.
    function feeForMove(int24 moved) public pure returns (uint24) {
        uint256 ticks = uint256(int256(moved));
        if (ticks >= FULL_MOVE_TICKS) return MAX_FEE;
        return MIN_FEE + uint24(ticks * (MAX_FEE - MIN_FEE) / FULL_MOVE_TICKS);
    }
}
`;
    },

    launch: (s) => {
      const win = Math.round(Number(s.windowMinutes));
      const units = toUnits(s.maxBuy, s.pairDecimals);
      const cool = Math.round(Number(s.cooldownSeconds));
      return `${HEADER('LaunchGuardHook', [
        `@notice For the first ${win} minute${win === 1 ? '' : 's'} after the pool opens, buys of \`token\` are limited:`,
        `@notice at most ${s.maxBuy} of the paying token per buy, exact-input only,`,
        `@notice and one buy per wallet every ${cool} second${cool === 1 ? '' : 's'}. After that, trading is unrestricted.`,
        '@notice "Wallet" is tx.origin, the account that signed the transaction. A bot',
        '@notice can still spread buys over many wallets; this slows it down, it does not stop it.'
      ])}

import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";

contract LaunchGuardHook is BaseHook {
    using PoolIdLibrary for PoolKey;

    uint256 public constant LAUNCH_WINDOW = ${win} minutes;

    /// @notice Largest buy during launch, in the smallest unit of the token paid with
    /// (${s.maxBuy} with ${Number(s.pairDecimals)} decimals).
    uint256 public constant MAX_BUY = ${group(units)};

    uint256 public constant COOLDOWN = ${cool} seconds;

    /// @notice The token being launched.
    Currency public immutable token;

    mapping(PoolId => uint256) public launchedAt;
    mapping(PoolId => mapping(address => uint256)) public lastBuyAt;

    error ZeroToken();
    error TokenNotInPool();
    error ExactOutputBuyDuringLaunch();
    error BuyTooLarge(uint256 amount, uint256 max);
    error CooldownActive(uint256 readyAt);

    constructor(IPoolManager _poolManager, address _token) BaseHook(_poolManager) {
        if (_token == address(0)) revert ZeroToken();
        token = Currency.wrap(_token);
    }

${permissionsBlock(PERMS.launch)}

    function _afterInitialize(address, PoolKey calldata key, uint160, int24)
        internal
        override
        returns (bytes4)
    {
        if (!(key.currency0 == token) && !(key.currency1 == token)) revert TokenNotInPool();
        launchedAt[key.toId()] = block.timestamp;
        return BaseHook.afterInitialize.selector;
    }

    function _beforeSwap(address, PoolKey calldata key, SwapParams calldata params, bytes calldata)
        internal
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        PoolId id = key.toId();
        Currency bought = params.zeroForOne ? key.currency1 : key.currency0;

        if (bought == token && block.timestamp < launchedAt[id] + LAUNCH_WINDOW) {
            // amountSpecified < 0 means exact input: the trader fixes what they pay.
            if (params.amountSpecified >= 0) revert ExactOutputBuyDuringLaunch();
            uint256 paying = uint256(-params.amountSpecified);
            if (paying > MAX_BUY) revert BuyTooLarge(paying, MAX_BUY);

            uint256 last = lastBuyAt[id][tx.origin];
            if (last != 0 && block.timestamp < last + COOLDOWN) revert CooldownActive(last + COOLDOWN);
            lastBuyAt[id][tx.origin] = block.timestamp;
        }

        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }
}
`;
    },

    hours: (s) => {
      const open = minutesOf(s.open);
      const close = minutesOf(s.close);
      const wk = !!s.weekdaysOnly;
      return `${HEADER('TradingHoursHook', [
        `@notice Swaps only go through between ${s.open} and ${s.close} UTC${wk ? ', Monday to Friday' : ', every day'}.`,
        '@notice Outside those hours every swap reverts. Adding and removing liquidity always works.',
        '@notice Hours are fixed in UTC and do not follow daylight saving time or holidays.'
      ])}

import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";

contract TradingHoursHook is BaseHook {
    /// @notice Minutes after midnight UTC.
    uint256 public constant OPEN_MINUTE = ${open}; // ${s.open}
    uint256 public constant CLOSE_MINUTE = ${close}; // ${s.close}
    bool public constant WEEKDAYS_ONLY = ${wk};

    error MarketClosed();

    constructor(IPoolManager _poolManager) BaseHook(_poolManager) {}

${permissionsBlock(PERMS.hours)}

    /// @notice Whether swaps go through right now.
    function isOpen() public view returns (bool) {
        // 1 Jan 1970 was a Thursday, so this gives 0 = Sunday ... 6 = Saturday.
        uint256 day = (block.timestamp / 1 days + 4) % 7;
        if (WEEKDAYS_ONLY && (day == 0 || day == 6)) return false;

        uint256 minute = (block.timestamp % 1 days) / 1 minutes;
        if (OPEN_MINUTE < CLOSE_MINUTE) return minute >= OPEN_MINUTE && minute < CLOSE_MINUTE;
        // The window runs past midnight.
        return minute >= OPEN_MINUTE || minute < CLOSE_MINUTE;
    }

    function _beforeSwap(address, PoolKey calldata, SwapParams calldata, bytes calldata)
        internal
        view
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        if (!isOpen()) revert MarketClosed();
        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }
}
`;
    }
  };

  // Constructor arguments after the PoolManager, for the deploy step.
  const constructorArgs = (recipe, s) => {
    if (recipe === 'fee') return [{ name: '_recipient', type: 'address', value: String(s.recipient).trim() }];
    if (recipe === 'launch') return [{ name: '_token', type: 'address', value: String(s.token).trim() }];
    return [];
  };

  // Values the template can always print: anything malformed falls back to
  // the default, and the problem is still reported.
  const printable = (recipe, s) => {
    const out = { ...s };
    RECIPES[recipe].fields.forEach((f) => {
      if (f.type === 'number' && (!Number.isFinite(Number(out[f.key])) || String(out[f.key]).trim() === '')) out[f.key] = f.value;
      if (f.type === 'number') out[f.key] = Math.min(f.max, Math.max(f.min, Number(out[f.key])));
      if (f.type === 'time' && !isTime(out[f.key])) out[f.key] = f.value;
    });
    if (recipe === 'dynamic' && out.floorPercent > out.ceilingPercent) out.ceilingPercent = out.floorPercent;
    return out;
  };

  /* ---------- deploy script (Foundry) ---------- */

  const FLAG_NAMES = {
    afterInitialize: 'AFTER_INITIALIZE_FLAG',
    beforeSwap: 'BEFORE_SWAP_FLAG',
    afterSwap: 'AFTER_SWAP_FLAG',
    afterSwapReturnDelta: 'AFTER_SWAP_RETURNS_DELTA_FLAG'
  };
  const ENV_NAMES = { _recipient: 'RECIPIENT', _token: 'TOKEN' };

  // Addresses come from environment variables, not literals: Solidity rejects
  // address literals that are not checksummed, and this keeps keys and
  // addresses out of the file.
  const deployScript = (recipe, settings) => {
    const name = RECIPES[recipe].contract;
    const args = constructorArgs(recipe, settings);
    const flags = PERMS[recipe].map((k) => `Hooks.${FLAG_NAMES[k]}`).join(' | ');
    const envLines = args.map((a) => `        address ${a.name.slice(1)} = vm.envAddress("${ENV_NAMES[a.name]}");`).join('\n');
    const argList = ['manager', ...args.map((a) => a.name.slice(1))].join(', ');
    const envUsage = ['POOL_MANAGER=0x…', ...args.map((a) => `${ENV_NAMES[a.name]}=${a.value || '0x…'}`)].join(' ');
    return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
import {${name}} from "../src/${name}.sol";

/// Deploys ${name} at an address whose low 14 bits match its permissions.
///
///   ${envUsage} \\
///   forge script script/Deploy${name}.s.sol --rpc-url $RPC_URL --account <your keystore> --broadcast
contract Deploy${name} is Script {
    function run() external {
        IPoolManager manager = IPoolManager(vm.envAddress("POOL_MANAGER"));
${envLines ? envLines + '\n' : ''}
        uint160 flags = uint160(${flags});
        bytes memory args = abi.encode(${argList});
        (address expected, bytes32 salt) =
            HookMiner.find(CREATE2_FACTORY, flags, type(${name}).creationCode, args);

        vm.startBroadcast();
        ${name} hook = new ${name}{salt: salt}(${argList});
        vm.stopBroadcast();

        require(address(hook) == expected, "hook landed at the wrong address");
        console.log("${name} deployed at", address(hook));
    }
}
`;
  };

  const generate = (recipe, settings) => {
    const s = { ...defaults(recipe), ...settings };
    const issues = problems(recipe, s);
    const r = RECIPES[recipe];
    return {
      recipe,
      contract: r.contract,
      file: `${r.contract}.sol`,
      // With problems the source still renders, so people see the shape of it,
      // but placeholders stand in for what is missing.
      source: TEMPLATES[recipe](printable(recipe, s)),
      problems: issues,
      permissions: PERMS[recipe],
      flags: flagsFor(recipe),
      args: constructorArgs(recipe, s),
      script: deployScript(recipe, s),
      scriptFile: `Deploy${r.contract}.s.sol`,
      dynamicFee: recipe === 'dynamic'
    };
  };

  /* ---------- understanding a request ---------- */

  const RULES = [
    ['dynamic', /volatil|dynamic|calm|quiet|moves? fast|spikes?/i],
    ['launch', /snip|bots?\b|launch (protection|window)|first (\d+\s*)?(hour|hours|minutes?|mins?|blocks?)|max(imum)? buy|cap (each|every|wallet)|per wallet|anti.?bot|cooldown/i],
    ['hours', /trading hours|market hours|opening hours|\bopen(s)?\b.*\bclose|schedule|weekdays?|\d{1,2}:\d{2}|\b\d{1,2}\s*(am|pm)\b|only (trade|trading) (during|between)/i],
    ['fee', /fee|tax|cut|%|send|treasury|royalt|commission|percent/i]
  ];

  const pickTime = (h, m, ap) => {
    let hour = Number(h);
    if (ap) {
      if (/pm/i.test(ap) && hour < 12) hour += 12;
      if (/am/i.test(ap) && hour === 12) hour = 0;
    }
    if (hour > 23) return null;
    return `${String(hour).padStart(2, '0')}:${String(Number(m || 0)).padStart(2, '0')}`;
  };

  // Returns { recipe, settings, heard: [what was understood], missing: [...] } or null.
  const understand = (text, current = {}) => {
    const t = String(text || '');
    if (!t.trim()) return null;
    const hit = RULES.find(([, re]) => re.test(t));
    if (!hit) return null;
    const recipe = hit[0];
    const s = { ...defaults(recipe), ...(current.recipe === recipe ? current.settings : {}) };
    const heard = [];

    const percents = [...t.matchAll(/(\d+(?:[.,]\d+)?)\s*(%|percent|per ?cent)/gi)].map((m) => Number(m[1].replace(',', '.')));
    const address = (t.match(/0x[0-9a-fA-F]{40}/) || [])[0];
    const duration = t.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|days?|d)\b/i);
    const amount = t.match(/(\d+(?:[.,]\d+)?)\s*(eth|weth|usdg|usdc|usd|\$)/i);

    if (recipe === 'fee') {
      if (percents.length) { s.feePercent = percents[0]; heard.push(`${percents[0]}% of every swap`); }
      if (address) { s.recipient = address; heard.push(`paid to ${address.slice(0, 6)}…${address.slice(-4)}`); }
    }

    if (recipe === 'dynamic') {
      const floor = t.match(/(floor|min(imum)?|lowest|at least)\D{0,12}(\d+(?:[.,]\d+)?)\s*%/i);
      const ceil = t.match(/(ceiling|cap|max(imum)?|highest|at most|up to)\D{0,12}(\d+(?:[.,]\d+)?)\s*%/i);
      if (floor) s.floorPercent = Number(floor[3].replace(',', '.'));
      if (ceil) s.ceilingPercent = Number(ceil[3].replace(',', '.'));
      if (!floor && !ceil && percents.length >= 2) {
        s.floorPercent = Math.min(...percents.slice(0, 2));
        s.ceilingPercent = Math.max(...percents.slice(0, 2));
      }
      if (floor || ceil || percents.length >= 2) heard.push(`fee between ${s.floorPercent}% and ${s.ceilingPercent}%`);
      else heard.push(`fee between ${s.floorPercent}% and ${s.ceilingPercent}% (defaults)`);
    }

    if (recipe === 'launch') {
      if (address) { s.token = address; heard.push(`protecting ${address.slice(0, 6)}…${address.slice(-4)}`); }
      if (duration) {
        const n = Number(duration[1]);
        const unit = duration[2].toLowerCase();
        s.windowMinutes = Math.round(unit.startsWith('d') ? n * 1440 : unit.startsWith('h') ? n * 60 : n);
        heard.push(`for the first ${s.windowMinutes} minutes`);
      }
      if (amount) {
        s.maxBuy = Number(amount[1].replace(',', '.'));
        if (/usd/i.test(amount[2]) || amount[2] === '$') s.pairDecimals = /usdc/i.test(amount[2]) ? 6 : s.pairDecimals;
        heard.push(`buys capped at ${s.maxBuy} ${amount[2].toUpperCase()}`);
      }
      const cool = t.match(/(\d+)\s*(seconds?|secs?|s)\b/i);
      if (cool) { s.cooldownSeconds = Number(cool[1]); heard.push(`${s.cooldownSeconds}s between buys`); }
      else if (/one (buy|trade) per (wallet|block)|once per block/i.test(t)) { s.cooldownSeconds = 12; heard.push('about one buy per wallet per block'); }
    }

    if (recipe === 'hours') {
      if (/us market hours|nyse|nasdaq|wall street|market hours/i.test(t)) {
        s.open = '13:30'; s.close = '20:00'; s.weekdaysOnly = true;
        heard.push('US market hours, 13:30–20:00 UTC (9:30–16:00 New York in summer)');
      }
      const times = [...t.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/gi)]
        .filter((m) => m[2] !== undefined || m[3])
        .map((m) => pickTime(m[1], m[2], m[3]))
        .filter(Boolean);
      if (times.length >= 2) { s.open = times[0]; s.close = times[1]; heard.push(`open ${s.open}–${s.close} UTC`); }
      else if (times.length === 1) { s.open = times[0]; heard.push(`opens at ${s.open} UTC`); }
      if (/weekdays?|monday to friday|mon-fri|business days/i.test(t)) { s.weekdaysOnly = true; heard.push('weekdays only'); }
      if (/every day|7 days|weekends? too|all week/i.test(t)) { s.weekdaysOnly = false; heard.push('every day'); }
    }

    return { recipe, settings: s, heard, missing: problems(recipe, s) };
  };

  const EXAMPLES = [
    'I\'m launching a token paired with ETH. Send 1% of every swap to my wallet.',
    'Raise the fee when the market gets volatile, lower it when it\'s calm. Floor 0.05%, ceiling 1%.',
    'For the first hour, cap every buy at 0.5 ETH and one buy per wallet every 30 seconds.',
    'Only trade during US market hours, weekdays.'
  ];

  return { RECIPES, EXAMPLES, defaults, generate, understand, isAddress, toUnits, ticksFor };
});
