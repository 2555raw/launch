/* Live mode: the pad's contracts on a real chain. Reads go through a public RPC
 * (so the board works before anyone connects), writes through the connected
 * wallet, and every write is simulated first so a revert shows up as a message
 * instead of a failed transaction. */
import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  decodeFunctionResult,
  encodeFunctionData,
  encodePacked,
  getContractAddress,
  http,
  keccak256,
  maxUint256,
  parseAbi,
  parseAbiItem,
  zeroAddress,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import uniswap from '@shared/uniswap.json';
import { deskAbi, launchpadAbi, routerAbi, coinAbi } from '../generated/contracts';
import { viemChain, type Deployment } from '../config/chains';
import { CURRENCY_BY_CODE, currencyColor } from '../data/currencies';
import { parseMeta } from '../lib/meta';
import { reservesFromPool } from '../lib/math';
import type { SwapQuote } from '../lib/route';
import type { Address, Backend, Coin, CoinMeta, CreateCoinInput, Currency, ExternalQuote, Params, PendingFees, RateMove, Snapshot, Trade, TxOptions } from './types';

const erc20 = [
  parseAbiItem('function approve(address spender, uint256 amount) returns (bool)'),
  parseAbiItem('function allowance(address owner, address spender) view returns (uint256)'),
  parseAbiItem('function balanceOf(address owner) view returns (uint256)'),
  parseAbiItem('function symbol() view returns (string)'),
] as const;

const wethAbi = [parseAbiItem('function deposit() payable'), parseAbiItem('function withdraw(uint256 wad)')] as const;

/* Uniswap on the chain, for swaps between real tokens (USDG <-> WETH): V3 through its quoter
 * and SwapRouter02 (or the first SwapRouter, which takes a deadline, on a local chain), V2
 * through its router, or straight on the pair where a chain has no router. */
const quoterV2Abi = parseAbi([
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
]);
const swapRouter02Abi = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)',
]);
const swapRouterAbi = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)',
]);
const v2RouterAbi = parseAbi([
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)',
]);
const v2FactoryAbi = parseAbi(['function getPair(address tokenA, address tokenB) view returns (address pair)']);
const v2PairAbi = parseAbi([
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() view returns (address)',
  'function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes data)',
  'function transfer(address to, uint256 amount) returns (bool)',
]);
const V3_FEES = [100, 500, 3000, 10000] as const;
type UniConfig = { v2Factory?: Address; v2Router02?: Address; v3?: { quoterV2: Address; swapRouter02?: Address; swapRouter?: Address } };
type UniFile = {
  v2Factory?: Record<string, string>;
  v2Router02?: Record<string, string>;
  v3?: Record<string, { factory: string; quoterV2: string; swapRouter02?: string; positionManager: string }>;
};
/** Uniswap's own on a chain that has it, else what the pad was deployed beside (a local chain). */
function uniswapOn(dep: Deployment): UniConfig {
  const u = uniswap as UniFile;
  const id = String(dep.chainId);
  const own = u.v3?.[id];
  return {
    v2Factory: u.v2Factory?.[id] as Address | undefined,
    v2Router02: u.v2Router02?.[id] as Address | undefined,
    v3: own
      ? { quoterV2: own.quoterV2 as Address, swapRouter02: own.swapRouter02 as Address | undefined }
      : dep.quoterV2
        ? { quoterV2: dep.quoterV2, swapRouter: dep.swapRouter }
        : undefined,
  };
}

const EV_CREATED = parseAbiItem(
  'event CoinCreated(address indexed coin, address indexed creator, address indexed currency, string name, string symbol, string meta, address pool, uint256 tokenId, uint256 startQuote)',
);
const EV_TRADE = parseAbiItem(
  'event Trade(address indexed coin, address indexed trader, bool isBuy, uint256 quoteAmount, uint256 tokenAmount, uint256 fee, uint160 sqrtPriceX96, uint256 timestamp)',
);
const EV_RATE = parseAbiItem('event RateUpdated(address indexed token, uint256 oldRate, uint256 newRate)');
// a coin's Uniswap V3 pool: trades made there from anywhere (DEX screens, terminals, Uniswap)
const EV_SWAP = parseAbiItem(
  'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)',
);

const FRIENDLY: Record<string, string> = {
  Slippage: 'The price moved past your slippage limit. Try again or allow more slippage.',
  FaucetCooldown: 'You already used the faucet for this currency recently. It refills every hour.',
  NotMintable: 'This currency is a real token; the faucet only hands out test currencies.',
  BadSymbol: 'Tickers are 1-10 capital letters or digits.',
  BadName: 'Names are 1-40 characters.',
  MetaTooLong: 'The image or description is too large. Try a smaller image.',
  CurrencyNotListed: 'That currency is not on the desk.',
  ZeroAmount: 'Nothing to do: the amount is zero.',
  InsufficientBalance: 'Not enough balance for that.',
  Expired: 'The swap took too long to confirm and expired. Try again.',
  NotRouter: 'Only the router can do that.',
  BadSalt: 'The coin address did not sort below its currency; try launching again.',
  PoolTaken: 'A pool for this coin already exists; try launching again.',
  BadStart: 'The launch price could not be set for this currency.',
};

export function explainError(e: unknown): string {
  if (e instanceof BaseError) {
    const revert = e.walk((err) => err instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    const name = revert?.data?.errorName;
    if (name && FRIENDLY[name]) return FRIENDLY[name];
    if (name) return `The contract refused: ${name}.`;
    const any = e as BaseError & { code?: number };
    if (any.code === 4001 || /rejected|denied/i.test(e.shortMessage)) return 'You rejected the request in your wallet.';
    if (/insufficient funds/i.test(e.message)) return 'Not enough ETH to pay for gas on this network.';
    return e.shortMessage || e.message;
  }
  const m = (e as { message?: string })?.message;
  if (m && /rejected|denied/i.test(m)) return 'You rejected the request in your wallet.';
  return m || 'Something went wrong.';
}

type GetWallet = () => Promise<WalletClient>;

export class LiveBackend implements Backend {
  kind = 'live' as const;
  chainId: number;
  addresses: Backend['addresses'];
  client: PublicClient;
  private dep: Deployment;
  private getWallet: GetWallet;

  private logCursor: bigint;
  private metaByCoin = new Map<string, CoinMeta>();
  private trades: Trade[] = [];
  private rateMoves: RateMove[] = [];
  private blockTimes = new Map<bigint, number>();
  private span = 20_000n;
  private initCodeHash?: Hex;

  constructor(dep: Deployment, getWallet: GetWallet) {
    this.dep = dep;
    this.chainId = dep.chainId;
    this.getWallet = getWallet;
    this.addresses = {
      launchpad: dep.launchpad,
      desk: dep.desk,
      router: dep.router,
      coinImplementation: dep.coinImplementation,
      positionManager: dep.positionManager,
    };
    this.client = createPublicClient({ chain: viemChain(dep.chainId), transport: http(dep.rpcUrl), batch: { multicall: false } }) as PublicClient;
    this.logCursor = BigInt(dep.deployBlock);
  }

  private read<T>(address: Address, abi: any, functionName: string, args: unknown[] = []): Promise<T> {
    return this.client.readContract({ address, abi, functionName, args }) as Promise<T>;
  }

  /** getLogs over a range, splitting it when a public RPC refuses a wide one. */
  private async logs(event: any, address: Address | Address[], from: bigint, to: bigint): Promise<any[]> {
    const out: any[] = [];
    let start = from;
    while (start <= to) {
      const end = start + this.span - 1n > to ? to : start + this.span - 1n;
      try {
        out.push(...(await this.client.getLogs({ address, event, fromBlock: start, toBlock: end })));
        start = end + 1n;
      } catch (e) {
        if (this.span <= 500n) throw e;
        this.span /= 4n;
      }
    }
    return out;
  }

  /** Fills made straight in the coins' pools, wherever they came from. The pad's own swaps
   *  there are skipped: its Trade event already names the trader. The coin is always token0. */
  private async addPoolTrades(swaps: any[], coins: Coin[], feePips: bigint) {
    if (!swaps.length) return;
    const byPool = new Map(coins.filter((c) => c.pool).map((c) => [c.pool!.toLowerCase(), c]));
    const pad = this.dep.launchpad.toLowerCase();
    for (const l of swaps) {
      if (l.args.sender.toLowerCase() === pad) continue;
      const coin = byPool.get(l.address.toLowerCase());
      if (!coin) continue;
      const amount0 = BigInt(l.args.amount0);
      const amount1 = BigInt(l.args.amount1);
      const isBuy = amount0 < 0n;
      const quote = amount1 < 0n ? -amount1 : amount1;
      const tokens = amount0 < 0n ? -amount0 : amount0;
      const r = reservesFromPool(BigInt(l.args.sqrtPriceX96), BigInt(l.args.liquidity));
      this.trades.push({
        id: `${l.transactionHash}:${l.logIndex}`,
        coin: coin.address,
        trader: l.args.recipient,
        isBuy,
        quoteAmount: quote,
        tokenAmount: tokens,
        fees: isBuy ? (quote * feePips) / 1_000_000n : (quote * feePips) / (1_000_000n - feePips),
        reserveToken: r.reserveToken,
        reserveQuote: r.reserveQuote,
        timestamp: await this.timeOf(l.blockNumber),
        txHash: l.transactionHash,
        via: 'pool',
      });
    }
    this.trades.sort((a, b) => a.timestamp - b.timestamp);
  }

  private async timeOf(block: bigint): Promise<number> {
    const hit = this.blockTimes.get(block);
    if (hit) return hit;
    const b = await this.client.getBlock({ blockNumber: block });
    const t = Number(b.timestamp);
    this.blockTimes.set(block, t);
    return t;
  }

  async load(): Promise<Snapshot> {
    const { launchpad } = this.dep;
    // The launchpad says which desk and router are its own; the record only has to get it right.
    const [deskOnChain, routerOnChain] = await Promise.all([
      this.read<Address>(launchpad, launchpadAbi, 'desk'),
      this.read<Address>(launchpad, launchpadAbi, 'router'),
    ]);
    if (deskOnChain.toLowerCase() !== this.dep.desk.toLowerCase() || routerOnChain.toLowerCase() !== this.dep.router.toLowerCase()) {
      console.warn(`deployment record for chain ${this.dep.chainId}: the launchpad names desk ${deskOnChain} and router ${routerOnChain}; using those`);
      this.dep = { ...this.dep, desk: deskOnChain, router: routerOnChain };
    }
    const desk = this.dep.desk;
    const [raw, count, startMcapUsd, poolFee, treasury, deskFeeBps, faucetUsd, faucetCooldown, head] = await Promise.all([
      this.read<any[]>(desk, deskAbi, 'getCurrencies'),
      this.read<bigint>(launchpad, launchpadAbi, 'coinsCount'),
      this.read<bigint>(launchpad, launchpadAbi, 'startMcapUsd'),
      this.read<number>(launchpad, launchpadAbi, 'POOL_FEE'),
      this.read<Address>(launchpad, launchpadAbi, 'treasury'),
      this.read<number>(desk, deskAbi, 'feeBps'),
      this.read<bigint>(desk, deskAbi, 'faucetUsd'),
      this.read<number>(desk, deskAbi, 'faucetCooldown'),
      this.client.getBlock(),
    ]);

    const currencies: Currency[] = raw.map((c) => {
      const s = CURRENCY_BY_CODE[c.code];
      return {
        token: c.token,
        code: c.code,
        name: s?.name ?? c.code,
        symbol: s?.symbol ?? c.code,
        region: s?.region ?? 'Other',
        kind: s?.kind ?? 'fiat',
        decimals: Number(c.decimals),
        rate: c.rate,
        updatedAt: Number(c.updatedAt),
        mintable: c.mintable,
        color: currencyColor(c.code),
      };
    });
    // Real tokens: their own symbol beside the code (USDG listed as USD), and what the
    // desk holds of them, which is the most it can convert into.
    await Promise.all(
      currencies
        .filter((c) => !c.mintable)
        .map(async (c) => {
          const [sym, held] = await Promise.all([
            this.read<string>(c.token, erc20, 'symbol').catch(() => c.code),
            this.read<bigint>(c.token, erc20, 'balanceOf', [desk]).catch(() => 0n),
          ]);
          c.reserve = held;
          if (sym && sym !== c.code) {
            c.tokenSymbol = sym;
            c.name = `${c.name} (${sym})`;
          }
          if (c.code === 'ETH' && sym === 'WETH') this.wethToken = c.token;
        }),
    );

    // The markets first, so their pools are known when the logs are read.
    const coins: Coin[] = [];
    const PAGE = 200n;
    for (let off = 0n; off < count; off += PAGE) {
      const page = await this.read<any[]>(launchpad, launchpadAbi, 'getCoins', [off, PAGE]);
      for (const c of page) {
        coins.push({
          address: c.coin,
          name: c.name,
          symbol: c.symbol,
          creator: c.creator,
          currency: c.currency,
          createdAt: Number(c.createdAt),
          pool: c.pool,
          tokenId: c.tokenId,
          startQuote: c.startQuote,
          reserveToken: c.reserveToken,
          reserveQuote: c.reserveQuote,
          realQuote: c.realQuote,
          sqrtPriceX96: c.sqrtPriceX96,
          liquidity: c.liquidity,
          volume: c.volume,
          creatorFees: c.creatorFees,
          protocolFees: c.protocolFees,
          meta: { description: '', image: '', links: {} },
        });
      }
    }
    const pools = coins.map((c) => c.pool!).filter(Boolean);
    const liquidityOf = new Map(coins.map((c) => [c.address.toLowerCase(), c.liquidity ?? 0n]));
    const feePips = BigInt(poolFee);

    // New events since the last load.
    const to = head.number;
    if (to >= this.logCursor) {
      const [created, trades, rates, swaps] = await Promise.all([
        this.logs(EV_CREATED, launchpad, this.logCursor, to),
        this.logs(EV_TRADE, launchpad, this.logCursor, to),
        this.logs(EV_RATE, desk, this.logCursor, to),
        pools.length ? this.logs(EV_SWAP, pools, this.logCursor, to) : Promise.resolve([]),
      ]);
      for (const l of created) this.metaByCoin.set(l.args.coin.toLowerCase(), parseMeta(l.args.meta));
      for (const l of trades) {
        // the event carries the price after the fill; the reserves behind it are the pool's liquidity at that price
        const r = reservesFromPool(BigInt(l.args.sqrtPriceX96), liquidityOf.get(l.args.coin.toLowerCase()) ?? 0n);
        this.trades.push({
          id: `${l.transactionHash}:${l.logIndex}`,
          coin: l.args.coin,
          trader: l.args.trader,
          isBuy: l.args.isBuy,
          quoteAmount: l.args.quoteAmount,
          tokenAmount: l.args.tokenAmount,
          fees: l.args.fee,
          reserveToken: r.reserveToken,
          reserveQuote: r.reserveQuote,
          timestamp: Number(l.args.timestamp),
          txHash: l.transactionHash,
          via: 'pad',
        });
      }
      await this.addPoolTrades(swaps, coins, feePips);
      for (const l of rates.slice(-400)) {
        this.rateMoves.push({ token: l.args.token, oldRate: l.args.oldRate, newRate: l.args.newRate, timestamp: await this.timeOf(l.blockNumber) });
      }
      if (this.rateMoves.length > 400) this.rateMoves = this.rateMoves.slice(-400);
      this.logCursor = to + 1n;
    }

    for (const c of coins) c.meta = this.metaByCoin.get(c.address.toLowerCase()) ?? c.meta;

    const params: Params = {
      startMcapUsd,
      poolFeePips: Number(poolFee),
      deskFeeBps: Number(deskFeeBps),
      faucetUsd,
      faucetCooldown: Number(faucetCooldown),
      treasury,
    };

    return {
      currencies,
      coins,
      trades: this.trades,
      rateMoves: this.rateMoves,
      params,
      clockSkew: Number(head.timestamp) - Date.now() / 1000,
      loadedAt: Date.now(),
    };
  }

  async balances(account: Address, tokens: Address[]) {
    const out: Record<string, bigint> = {};
    for (let i = 0; i < tokens.length; i += 150) {
      const part = tokens.slice(i, i + 150);
      const vals = await this.read<bigint[]>(this.dep.router, routerAbi, 'balancesOf', [account, part]);
      part.forEach((t, j) => (out[t.toLowerCase()] = vals[j]));
    }
    // plain ETH too: the pad wraps it when a buyer pays in wrapped ether, keeping enough for
    // the gas of a launch (it opens a Uniswap pool: about 8M gas at the chain's price now,
    // and at least 0.0001 ETH)
    if (this.wethToken) {
      const [native, gasPrice] = await Promise.all([this.client.getBalance({ address: account }), this.client.getGasPrice().catch(() => 0n)]);
      out.native = native;
      const need = gasPrice * 8_000_000n;
      out.gasReserve = need > 100_000_000_000_000n ? need : 100_000_000_000_000n;
    }
    return out;
  }

  async allowances(account: Address, spender: 'launchpad' | 'router' | 'desk', tokens: Address[]) {
    const out: Record<string, bigint> = {};
    const vals = await this.read<bigint[]>(this.dep.router, routerAbi, 'allowancesOf', [account, this.dep[spender], tokens]);
    tokens.forEach((t, j) => (out[t.toLowerCase()] = vals[j]));
    return out;
  }

  /** What collecting would pay out right now, simulated: the pool's fees owed to the pad's position. */
  async pendingFees(coins: Address[]) {
    const out: Record<string, PendingFees> = {};
    await Promise.all(
      coins.map(async (coin) => {
        try {
          const { result } = await this.client.simulateContract({ address: this.dep.launchpad, abi: launchpadAbi, functionName: 'collectFees', args: [coin] });
          const [coinFees, quoteFees] = result as readonly [bigint, bigint];
          out[coin.toLowerCase()] = { coin: coinFees, quote: quoteFees };
        } catch {
          out[coin.toLowerCase()] = { coin: 0n, quote: 0n };
        }
      }),
    );
    return out;
  }

  async faucetReadyAt(account: Address, token: Address) {
    const [last, cooldown] = await Promise.all([
      this.read<bigint>(this.dep.desk, deskAbi, 'lastFaucet', [account, token]),
      this.read<number>(this.dep.desk, deskAbi, 'faucetCooldown'),
    ]);
    return last === 0n ? 0 : Number(last) + Number(cooldown);
  }

  /* -------------------------------- writes -------------------------------- */

  private async write(account: Address, req: { address: Address; abi: any; functionName: string; args: unknown[]; value?: bigint }, o?: TxOptions) {
    const wallet = await this.getWallet();
    const { request } = await this.client.simulateContract({ ...req, account } as any);
    o?.onStage?.('sign');
    const hash = await wallet.writeContract({ ...(request as any), account, chain: wallet.chain });
    o?.onStage?.('pending', hash);
    const receipt = await this.client.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error('The transaction reverted on chain.');
    o?.onStage?.('done', hash);
    return { hash, receipt };
  }

  /** Wrapped ether on this chain (the desk lists it as ETH), which the pad can wrap for a buyer. */
  private wethToken?: Address;

  /** Paying in wrapped ether with plain ETH in the wallet: wraps what is missing first. */
  private async ensureWrapped(account: Address, token: Address, amount: bigint, o?: TxOptions) {
    if (!this.wethToken || token.toLowerCase() !== this.wethToken.toLowerCase()) return;
    const held = await this.read<bigint>(token, erc20, 'balanceOf', [account]);
    if (held >= amount) return;
    const missing = amount - held;
    o?.onStage?.('wrap');
    await this.write(account, { address: token, abi: wethAbi, functionName: 'deposit', args: [], value: missing }, { onStage: (s, d) => s === 'pending' && o?.onStage?.('pending', d) });
  }

  async unwrap(account: Address, token: Address, amount: bigint, o?: TxOptions) {
    const { hash } = await this.write(account, { address: token, abi: wethAbi, functionName: 'withdraw', args: [amount] }, o);
    return { hash };
  }

  /** The best Uniswap price on this chain for tokenIn -> tokenOut: every V3 fee tier the
   *  quoter answers for, and the V2 pair if there is one; null when no pool has the pair. */
  async quoteExternal(tokenIn: Address, tokenOut: Address, amountIn: bigint): Promise<ExternalQuote | null> {
    const u = uniswapOn(this.dep);
    const found: ExternalQuote[] = [];
    if (u.v3) {
      const quoter = u.v3.quoterV2;
      await Promise.all(
        V3_FEES.map(async (fee) => {
          try {
            const data = encodeFunctionData({ abi: quoterV2Abi, functionName: 'quoteExactInputSingle', args: [{ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0n }] });
            const { data: out } = await this.client.call({ to: quoter, data });
            if (!out) return;
            const [amountOut] = decodeFunctionResult({ abi: quoterV2Abi, functionName: 'quoteExactInputSingle', data: out });
            if (amountOut > 0n) found.push({ tokenIn, tokenOut, amountIn, amountOut, kind: 'v3', fee, via: `Uniswap V3 pool, ${fee / 10_000}% fee` });
          } catch {
            /* no pool at this fee, or too thin */
          }
        }),
      );
    }
    if (u.v2Factory) {
      try {
        const pair = await this.read<Address>(u.v2Factory, v2FactoryAbi, 'getPair', [tokenIn, tokenOut]);
        if (pair !== zeroAddress) {
          const [[r0, r1], token0] = await Promise.all([this.read<[bigint, bigint, number]>(pair, v2PairAbi, 'getReserves'), this.read<Address>(pair, v2PairAbi, 'token0')]);
          const inIs0 = token0.toLowerCase() === tokenIn.toLowerCase();
          const [rIn, rOut] = inIs0 ? [r0, r1] : [r1, r0];
          if (rIn > 0n && rOut > 0n) {
            const withFee = amountIn * 997n;
            const amountOut = (withFee * rOut) / (rIn * 1000n + withFee);
            if (amountOut > 0n) found.push({ tokenIn, tokenOut, amountIn, amountOut, kind: 'v2', fee: 3000, via: 'Uniswap V2 pool, 0.3% fee' });
          }
        }
      } catch {
        /* no V2 pair */
      }
    }
    if (!found.length) return null;
    return found.reduce((best, q) => (q.amountOut > best.amountOut ? q : best));
  }

  /** The swap `quoteExternal` priced, paid from the wallet (plain ETH wrapped first if needed). */
  async swapExternal(account: Address, q: ExternalQuote, minOut: bigint, o?: TxOptions) {
    const u = uniswapOn(this.dep);
    if (q.kind === 'v3' && u.v3) {
      const router = u.v3.swapRouter02 ?? u.v3.swapRouter;
      if (!router) throw new Error('No Uniswap router on this chain.');
      await this.ensureAllowance(account, q.tokenIn, router, q.amountIn, o);
      const req = u.v3.swapRouter02
        ? {
            address: u.v3.swapRouter02,
            abi: swapRouter02Abi,
            functionName: 'exactInputSingle',
            args: [{ tokenIn: q.tokenIn, tokenOut: q.tokenOut, fee: q.fee, recipient: account, amountIn: q.amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0n }],
          }
        : {
            address: router,
            abi: swapRouterAbi,
            functionName: 'exactInputSingle',
            args: [
              {
                tokenIn: q.tokenIn,
                tokenOut: q.tokenOut,
                fee: q.fee,
                recipient: account,
                deadline: BigInt(Math.floor(Date.now() / 1000) + 20 * 60),
                amountIn: q.amountIn,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0n,
              },
            ],
          };
      const { hash } = await this.write(account, req, o);
      return { hash };
    }
    if (q.kind === 'v2' && u.v2Factory) {
      if (u.v2Router02) {
        await this.ensureAllowance(account, q.tokenIn, u.v2Router02, q.amountIn, o);
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
        const { hash } = await this.write(
          account,
          { address: u.v2Router02, abi: v2RouterAbi, functionName: 'swapExactTokensForTokens', args: [q.amountIn, minOut, [q.tokenIn, q.tokenOut], account, deadline] },
          o,
        );
        return { hash };
      }
      // no router on this chain: pay the pair, then take the swap
      const pair = await this.read<Address>(u.v2Factory, v2FactoryAbi, 'getPair', [q.tokenIn, q.tokenOut]);
      await this.ensureWrapped(account, q.tokenIn, q.amountIn, o);
      await this.write(account, { address: q.tokenIn, abi: v2PairAbi, functionName: 'transfer', args: [pair, q.amountIn] }, { onStage: (s, d) => s === 'pending' && o?.onStage?.('pending', d) });
      const [[r0, r1], token0] = await Promise.all([this.read<[bigint, bigint, number]>(pair, v2PairAbi, 'getReserves'), this.read<Address>(pair, v2PairAbi, 'token0')]);
      const inIs0 = token0.toLowerCase() === q.tokenIn.toLowerCase();
      // priced again now, from the reserves as they are, never below what the page agreed to
      const held = await this.read<bigint>(q.tokenIn, erc20, 'balanceOf', [pair]);
      const rIn = inIs0 ? r0 : r1;
      const rOut = inIs0 ? r1 : r0;
      const paid = held - rIn;
      const withFee = paid * 997n;
      const out = (withFee * rOut) / (rIn * 1000n + withFee);
      if (out < minOut) throw new Error('The price moved past your slippage limit. Try again or allow more slippage.');
      const { hash } = await this.write(account, { address: pair, abi: v2PairAbi, functionName: 'swap', args: [inIs0 ? 0n : out, inIs0 ? out : 0n, account, '0x'] }, o);
      return { hash };
    }
    throw new Error('No Uniswap pool for this pair on this chain.');
  }

  /** A route with a Uniswap leg: one transaction per leg, each fed what the one before really
   *  delivered (read from the wallet's balance), and each held to its own slippage. */
  async swapRoute(account: Address, q: SwapQuote, slipBps: number, o?: TxOptions) {
    let carry = q.steps[0]?.amountIn ?? 0n;
    let last: { hash?: string } = {};
    for (const s of q.steps) {
      // the leg's quoted output, scaled to what really arrived, less the slippage allowed
      const expected = s.amountIn === 0n ? 0n : (s.amountOut * carry) / s.amountIn;
      const min = (expected * BigInt(10_000 - slipBps)) / 10_000n;
      const before = await this.read<bigint>(s.tokenOut, erc20, 'balanceOf', [account]);
      if (s.kind === 'uniswap') last = await this.swapExternal(account, { ...s.external!, amountIn: carry }, min, o);
      else if (s.kind === 'buy') last = await this.buy(account, s.tokenOut, carry, min, o);
      else if (s.kind === 'sell') last = await this.sell(account, s.tokenIn, carry, min, o);
      else last = await this.swap(account, s.tokenIn, s.tokenOut, carry, min, o);
      const after = await this.read<bigint>(s.tokenOut, erc20, 'balanceOf', [account]);
      carry = after > before ? after - before : 0n;
      if (carry === 0n) throw new Error(`The ${s.from} → ${s.to} leg delivered nothing.`);
    }
    return last;
  }

  async deskOwner() {
    return this.read<Address>(this.dep.desk, deskAbi, 'owner');
  }

  async listCurrency(account: Address, token: Address, code: string, rate: bigint, o?: TxOptions) {
    const { hash } = await this.write(account, { address: this.dep.desk, abi: deskAbi, functionName: 'listCurrency', args: [token, code, rate] }, o);
    return { hash };
  }

  private async ensureAllowance(account: Address, token: Address, spender: Address, amount: bigint, o?: TxOptions) {
    await this.ensureWrapped(account, token, amount, o);
    const current = await this.read<bigint>(token, erc20, 'allowance', [account, spender]);
    if (current >= amount) return;
    o?.onStage?.('approve');
    const wallet = await this.getWallet();
    const hash = await wallet.writeContract({
      address: token,
      abi: erc20,
      functionName: 'approve',
      args: [spender, maxUint256],
      account,
      chain: wallet.chain,
    });
    const r = await this.client.waitForTransactionReceipt({ hash });
    if (r.status !== 'success') throw new Error('Approval failed.');
  }

  async faucet(account: Address, token: Address, o?: TxOptions) {
    const { hash } = await this.write(account, { address: this.dep.desk, abi: deskAbi, functionName: 'faucet', args: [token] }, o);
    return { hash };
  }

  /** A salt whose coin address sorts below the currency's, so the coin is its pool's token0
   *  (a few thousand hashes at most; a handful on average). */
  private async mineSalt(account: Address, currency: Address): Promise<{ salt: Hex; coin: Address }> {
    if (!this.initCodeHash) this.initCodeHash = await this.read<Hex>(this.dep.launchpad, launchpadAbi, 'coinInitCodeHash');
    const limit = BigInt(currency);
    const seed = BigInt(Date.now());
    for (let i = 0n; i < 500_000n; i++) {
      const salt = keccak256(encodePacked(['address', 'address', 'uint256', 'uint256'], [account, currency, seed, i]));
      const coin = getContractAddress({ opcode: 'CREATE2', from: this.dep.launchpad, salt, bytecodeHash: this.initCodeHash });
      if (BigInt(coin) < limit) return { salt, coin };
    }
    throw new Error('Could not find a coin address below the currency; try again.');
  }

  async createCoin(account: Address, input: CreateCoinInput, o?: TxOptions) {
    if (input.firstBuy > 0n) await this.ensureAllowance(account, input.currency, this.dep.launchpad, input.firstBuy, o);
    // contract-level metadata (ERC-7572), stored in the coin and served by contractURI()
    const meta = JSON.stringify({
      name: input.name,
      symbol: input.symbol,
      description: input.meta.description,
      image: input.meta.image,
      external_link: input.meta.links.website,
      links: input.meta.links,
      priced: input.meta.priced,
    });
    const { salt, coin: predicted } = await this.mineSalt(account, input.currency);
    const { hash, receipt } = await this.write(
      account,
      {
        address: this.dep.launchpad,
        abi: launchpadAbi,
        functionName: 'createCoin',
        args: [input.name, input.symbol, meta, input.currency, salt, input.firstBuy, input.minTokensOut],
      },
      o,
    );
    const createdTopic = receipt.logs.find((l) => l.address.toLowerCase() === this.dep.launchpad.toLowerCase() && l.topics.length === 4);
    const coin = createdTopic ? (`0x${createdTopic.topics[1]!.slice(26)}` as Address) : predicted;
    this.metaByCoin.set(coin.toLowerCase(), input.meta);
    return { hash, coin };
  }

  async buy(account: Address, coin: Address, quoteIn: bigint, minOut: bigint, o?: TxOptions) {
    const currency = await this.read<Address>(this.dep.launchpad, launchpadAbi, 'currencyOf', [coin]);
    await this.ensureAllowance(account, currency, this.dep.launchpad, quoteIn, o);
    const { hash } = await this.write(
      account,
      { address: this.dep.launchpad, abi: launchpadAbi, functionName: 'buy', args: [coin, quoteIn, minOut, account] },
      o,
    );
    return { hash };
  }

  async sell(account: Address, coin: Address, tokensIn: bigint, minOut: bigint, o?: TxOptions) {
    await this.ensureAllowance(account, coin, this.dep.launchpad, tokensIn, o);
    const { hash } = await this.write(
      account,
      { address: this.dep.launchpad, abi: launchpadAbi, functionName: 'sell', args: [coin, tokensIn, minOut, account] },
      o,
    );
    return { hash };
  }

  async swap(account: Address, tokenIn: Address, tokenOut: Address, amountIn: bigint, minOut: bigint, o?: TxOptions) {
    await this.ensureAllowance(account, tokenIn, this.dep.router, amountIn, o);
    const block = await this.client.getBlock();
    const deadline = block.timestamp + 20n * 60n;
    const { hash } = await this.write(
      account,
      { address: this.dep.router, abi: routerAbi, functionName: 'swap', args: [tokenIn, tokenOut, amountIn, minOut, account, deadline] },
      o,
    );
    return { hash };
  }

  async collectFees(account: Address, coin: Address, o?: TxOptions) {
    const { hash } = await this.write(account, { address: this.dep.launchpad, abi: launchpadAbi, functionName: 'collectFees', args: [coin] }, o);
    return { hash };
  }

  /** Raw code at an address, for the Verify page. */
  code(address: Address) {
    return this.client.getCode({ address });
  }

  coinAbi = coinAbi;
}
