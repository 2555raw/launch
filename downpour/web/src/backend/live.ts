/* Live mode: the pad's contracts on a real chain. Reads go through a public RPC
 * (so the board works before anyone connects), writes through the connected
 * wallet, and every write is simulated first so a revert shows up as a message
 * instead of a failed transaction. */
import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  http,
  maxUint256,
  parseAbiItem,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { deskAbi, launchpadAbi, routerAbi, coinAbi } from '../generated/contracts';
import { viemChain, type Deployment } from '../config/chains';
import { CURRENCY_BY_CODE, currencyColor } from '../data/currencies';
import { parseMeta } from '../lib/meta';
import type { Address, Backend, Coin, CoinMeta, CreateCoinInput, Currency, Params, RateMove, Snapshot, Trade, TxOptions } from './types';

const erc20 = [
  parseAbiItem('function approve(address spender, uint256 amount) returns (bool)'),
  parseAbiItem('function allowance(address owner, address spender) view returns (uint256)'),
  parseAbiItem('function balanceOf(address owner) view returns (uint256)'),
] as const;

const EV_CREATED = parseAbiItem(
  'event CoinCreated(address indexed coin, address indexed creator, address indexed currency, string name, string symbol, string meta, uint256 virtualQuote)',
);
const EV_TRADE = parseAbiItem(
  'event Trade(address indexed coin, address indexed trader, bool isBuy, uint256 quoteAmount, uint256 tokenAmount, uint256 protocolFee, uint256 creatorFee, uint256 snipeTax, uint256 reserveToken, uint256 reserveQuote, uint256 timestamp)',
);
const EV_RATE = parseAbiItem('event RateUpdated(address indexed token, uint256 oldRate, uint256 newRate)');

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

  constructor(dep: Deployment, getWallet: GetWallet) {
    this.dep = dep;
    this.chainId = dep.chainId;
    this.getWallet = getWallet;
    this.addresses = {
      launchpad: dep.launchpad,
      desk: dep.desk,
      router: dep.router,
      coinImplementation: dep.coinImplementation,
    };
    this.client = createPublicClient({ chain: viemChain(dep.chainId), transport: http(dep.rpcUrl), batch: { multicall: false } }) as PublicClient;
    this.logCursor = BigInt(dep.deployBlock);
  }

  private read<T>(address: Address, abi: any, functionName: string, args: unknown[] = []): Promise<T> {
    return this.client.readContract({ address, abi, functionName, args }) as Promise<T>;
  }

  /** getLogs over a range, splitting it when a public RPC refuses a wide one. */
  private async logs(event: any, address: Address, from: bigint, to: bigint): Promise<any[]> {
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

  private async timeOf(block: bigint): Promise<number> {
    const hit = this.blockTimes.get(block);
    if (hit) return hit;
    const b = await this.client.getBlock({ blockNumber: block });
    const t = Number(b.timestamp);
    this.blockTimes.set(block, t);
    return t;
  }

  async load(): Promise<Snapshot> {
    const { launchpad, desk } = this.dep;
    const [raw, count, targetRaiseUsd, protocolFeeBps, creatorFeeBps, snipeTaxBps, snipeWindow, treasury, deskFeeBps, faucetUsd, faucetCooldown, head] =
      await Promise.all([
        this.read<any[]>(desk, deskAbi, 'getCurrencies'),
        this.read<bigint>(launchpad, launchpadAbi, 'coinsCount'),
        this.read<bigint>(launchpad, launchpadAbi, 'targetRaiseUsd'),
        this.read<number>(launchpad, launchpadAbi, 'protocolFeeBps'),
        this.read<number>(launchpad, launchpadAbi, 'creatorFeeBps'),
        this.read<number>(launchpad, launchpadAbi, 'snipeTaxBps'),
        this.read<number>(launchpad, launchpadAbi, 'snipeWindow'),
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

    // New events since the last load.
    const to = head.number;
    if (to >= this.logCursor) {
      const [created, trades, rates] = await Promise.all([
        this.logs(EV_CREATED, launchpad, this.logCursor, to),
        this.logs(EV_TRADE, launchpad, this.logCursor, to),
        this.logs(EV_RATE, desk, this.logCursor, to),
      ]);
      for (const l of created) this.metaByCoin.set(l.args.coin.toLowerCase(), parseMeta(l.args.meta));
      for (const l of trades) {
        this.trades.push({
          id: `${l.transactionHash}:${l.logIndex}`,
          coin: l.args.coin,
          trader: l.args.trader,
          isBuy: l.args.isBuy,
          quoteAmount: l.args.quoteAmount,
          tokenAmount: l.args.tokenAmount,
          fees: l.args.protocolFee + l.args.creatorFee,
          snipeTax: l.args.snipeTax,
          reserveToken: l.args.reserveToken,
          reserveQuote: l.args.reserveQuote,
          timestamp: Number(l.args.timestamp),
          txHash: l.transactionHash,
        });
      }
      for (const l of rates.slice(-400)) {
        this.rateMoves.push({ token: l.args.token, oldRate: l.args.oldRate, newRate: l.args.newRate, timestamp: await this.timeOf(l.blockNumber) });
      }
      if (this.rateMoves.length > 400) this.rateMoves = this.rateMoves.slice(-400);
      this.logCursor = to + 1n;
    }

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
          graduated: c.graduated,
          virtualQuote: c.virtualQuote,
          reserveToken: c.reserveToken,
          reserveQuote: c.reserveQuote,
          realQuote: c.realQuote,
          curveLeft: c.curveLeft,
          volume: c.volume,
          meta: this.metaByCoin.get(c.coin.toLowerCase()) ?? { description: '', image: '', links: {} },
        });
      }
    }

    const params: Params = {
      targetRaiseUsd,
      protocolFeeBps: Number(protocolFeeBps),
      creatorFeeBps: Number(creatorFeeBps),
      snipeTaxBps: Number(snipeTaxBps),
      snipeWindow: Number(snipeWindow),
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
    return out;
  }

  async allowances(account: Address, spender: 'launchpad' | 'router' | 'desk', tokens: Address[]) {
    const out: Record<string, bigint> = {};
    const vals = await this.read<bigint[]>(this.dep.router, routerAbi, 'allowancesOf', [account, this.dep[spender], tokens]);
    tokens.forEach((t, j) => (out[t.toLowerCase()] = vals[j]));
    return out;
  }

  async feesOwed(account: Address, currencies: Address[]) {
    const out: Record<string, bigint> = {};
    const vals = await Promise.all(
      currencies.map((c) => this.read<bigint>(this.dep.launchpad, launchpadAbi, 'feesOwed', [account, c])),
    );
    currencies.forEach((c, i) => (out[c.toLowerCase()] = vals[i]));
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

  private async write(account: Address, req: { address: Address; abi: any; functionName: string; args: unknown[] }, o?: TxOptions) {
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

  private async ensureAllowance(account: Address, token: Address, spender: Address, amount: bigint, o?: TxOptions) {
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

  async createCoin(account: Address, input: CreateCoinInput, o?: TxOptions) {
    if (input.firstBuy > 0n) await this.ensureAllowance(account, input.currency, this.dep.launchpad, input.firstBuy, o);
    const meta = JSON.stringify(input.meta);
    const { hash, receipt } = await this.write(
      account,
      {
        address: this.dep.launchpad,
        abi: launchpadAbi,
        functionName: 'createCoin',
        args: [input.name, input.symbol, meta, input.currency, input.firstBuy, input.minTokensOut],
      },
      o,
    );
    const createdTopic = receipt.logs.find((l) => l.address.toLowerCase() === this.dep.launchpad.toLowerCase() && l.topics.length === 4);
    const coin = createdTopic ? (`0x${createdTopic.topics[1]!.slice(26)}` as Address) : undefined;
    if (coin) this.metaByCoin.set(coin.toLowerCase(), input.meta);
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

  async claimFees(account: Address, currency: Address, o?: TxOptions) {
    const { hash } = await this.write(
      account,
      { address: this.dep.launchpad, abi: launchpadAbi, functionName: 'claimFees', args: [currency] },
      o,
    );
    return { hash };
  }

  /** Raw code at an address, for the Verify page. */
  code(address: Address) {
    return this.client.getCode({ address });
  }

  coinAbi = coinAbi;
}
