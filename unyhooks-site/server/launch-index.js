/* UnyHooks — the launches made with UnyHooks, read from Robinhood Chain.

   Every launch emits UnyLaunch's Launched event from its own, fresh launcher
   contract, so there is no single address to filter by. The public RPC only
   answers address-free log queries over 30,000 blocks, so this walks the chain
   in 30,000-block windows from the block the launch kit went live, then keeps
   up every few minutes. Anyone can emit an event with the same shape, so a
   launch only counts when its token's code is byte for byte UnyToken's (and
   its lock's, LiquidityLock's).

   GET /api/launches answers from memory:
     { updatedAt, block, stats: { launches, ethPaired, locked, lockedForever, swaps },
       latest: [{ token, symbol, name, hook, poolId, creator, eth, lock, unlockAt, forever, time, tx }] }

   The index is kept in UNYHOOKS_DATA_DIR (else the Railway volume, else the
   OS temp dir), so a restart or a new deploy only reads what is new. */

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { ethers } = require('ethers');

const ROOT = path.join(__dirname, '..');
const K = require(path.join(ROOT, 'launch-kit.js'));

// The network settings the pages use (config.js assigns window.UNYHOOKS).
function loadConfig() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8'), sandbox);
  return sandbox.window.UNYHOOKS;
}

// The launch kit went live on 5 October 2026; nothing before this block can be a launch.
const START_BLOCK = Number(process.env.UNYHOOKS_START_BLOCK || 80_300_000);
const WINDOW = 30_000;            // the RPC's limit for logs without an address
const PARALLEL = 6;
const REFRESH_MS = 3 * 60_000;
const SWAP = 'event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)';
const LOCK_ABI = ['function unlockAt() view returns (uint256)'];
const ERC20 = ['function symbol() view returns (string)', 'function name() view returns (string)'];

function createIndex({ rpcUrl, chainId, poolManager, dataDir = process.env.UNYHOOKS_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || os.tmpdir(), log = () => {} } = {}) {
  const NET = rpcUrl ? { rpcUrl, chainId, poolManager } : loadConfig().NETWORK;
  const provider = new ethers.JsonRpcProvider(NET.rpcUrl, Number(NET.chainId), { staticNetwork: true });
  const launched = new ethers.Interface([K.LAUNCHED]);
  const topic = launched.getEvent('Launched').topicHash;
  const swapIface = new ethers.Interface([SWAP]);
  const file = path.join(dataDir, `unyhooks-launches-${NET.chainId}.json`);

  let state = { cursor: START_BLOCK - 1, launches: [], swapsCursor: START_BLOCK - 1, swaps: 0 };
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (saved && Number.isFinite(saved.cursor)) state = saved;
  } catch (_) { /* first run */ }
  let updatedAt = null;
  let running = null;

  const save = () => { try { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(state)); } catch (err) { log(`launch index: could not save (${err.message})`); } };
  const codeHash = async (a) => ethers.keccak256(await provider.getCode(a));

  // Launched events in [from, to], a window at a time, a few at once.
  const scan = async (from, to) => {
    const windows = [];
    for (let a = from; a <= to; a += WINDOW) windows.push([a, Math.min(to, a + WINDOW - 1)]);
    const out = [];
    for (let i = 0; i < windows.length; i += PARALLEL) {
      const batch = await Promise.all(windows.slice(i, i + PARALLEL).map(([a, b]) => provider.getLogs({ topics: [topic], fromBlock: a, toBlock: b })));
      out.push(...batch.flat());
    }
    return out;
  };

  // One Launched log, checked and filled in; null when it isn't a real UnyHooks launch.
  const describe = async (l) => {
    const ev = launched.parseLog(l).args;
    if ((await codeHash(ev.token)) !== K.CODEHASH.token) return null;
    const lock = BigInt(ev.lock) === 0n ? null : ethers.getAddress(ev.lock);
    if (lock && (await codeHash(lock)) !== K.CODEHASH.lock) return null;
    const t = new ethers.Contract(ev.token, ERC20, provider);
    const [symbol, name, tx, block, unlockAt] = await Promise.all([
      t.symbol().catch(() => '?'), t.name().catch(() => ''),
      provider.getTransaction(l.transactionHash), provider.getBlock(l.blockNumber),
      lock ? new ethers.Contract(lock, LOCK_ABI, provider).unlockAt() : 0n
    ]);
    return {
      token: ethers.getAddress(ev.token), symbol, name, hook: ethers.getAddress(ev.hook), poolId: ev.poolId,
      creator: ethers.getAddress(ev.creator), eth: ethers.formatEther(tx ? tx.value : 0n),
      lock, unlockAt: unlockAt.toString(), forever: unlockAt === K.MAX_UINT256,
      time: block ? block.timestamp : null, tx: l.transactionHash, block: l.blockNumber
    };
  };

  // Swaps through the launched pools since the last look.
  const countSwaps = async (to) => {
    const ids = state.launches.map((x) => x.poolId);
    if (!ids.length) { state.swapsCursor = to; return; }
    const from = state.swapsCursor + 1;
    if (from > to) return;
    const topicSwap = swapIface.getEvent('Swap').topicHash;
    let n = 0;
    for (let i = 0; i < ids.length; i += 40) {
      const chunk = ids.slice(i, i + 40);
      // the RPC allows 10 million blocks per address-filtered query
      for (let a = from; a <= to; a += 10_000_000) {
        n += (await provider.getLogs({ address: NET.poolManager, topics: [topicSwap, chunk], fromBlock: a, toBlock: Math.min(to, a + 9_999_999) })).length;
      }
    }
    state.swaps += n;
    state.swapsCursor = to;
  };

  const refresh = async () => {
    const latest = await provider.getBlockNumber();
    if (latest > state.cursor) {
      const logs = await scan(state.cursor + 1, latest);
      const known = new Set(state.launches.map((x) => x.tx));
      for (const l of logs) {
        if (known.has(l.transactionHash)) continue;
        try { const d = await describe(l); if (d) state.launches.push(d); } catch (err) { log(`launch index: skipped ${l.transactionHash} (${err.message})`); }
      }
      state.launches.sort((a, b) => b.block - a.block);
      state.cursor = latest;
    }
    await countSwaps(latest).catch((err) => log(`launch index: swaps (${err.message})`));
    updatedAt = new Date().toISOString();
    save();
  };

  const update = () => {
    if (!running) running = refresh().catch((err) => log(`launch index: ${err.message}`)).finally(() => { running = null; });
    return running;
  };

  const summary = () => {
    const L = state.launches;
    const eth = L.reduce((s, x) => s + Number(x.eth || 0), 0);
    return {
      updatedAt,
      block: state.cursor,
      ready: !!updatedAt,
      stats: {
        launches: L.length,
        ethPaired: Number(eth.toFixed(4)),
        locked: L.filter((x) => x.lock).length,
        lockedForever: L.filter((x) => x.forever).length,
        swaps: state.swaps
      },
      latest: L.slice(0, 6)
    };
  };

  let timer = null;
  const start = () => { update(); timer = setInterval(update, REFRESH_MS); if (timer.unref) timer.unref(); };
  const stop = () => clearInterval(timer);

  return { start, stop, update, summary };
}

module.exports = { createIndex, START_BLOCK };
