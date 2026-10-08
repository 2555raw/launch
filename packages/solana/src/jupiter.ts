/**
 * Jupiter Swap API v2 client (`/order` + `/execute`). Jupiter routes mainnet liquidity only;
 * on devnet there are no routes and `/order` returns an error, which we surface verbatim.
 */
export interface JupiterOrderParams {
  inputMint: string;
  outputMint: string;
  /** amount in the input token's smallest unit */
  amount: string;
  /** wallet that signs; omit to get a quote without a transaction */
  taker?: string;
  slippageBps?: number;
}

export interface JupiterOrderResponse {
  requestId: string;
  transaction: string | null;
  inAmount: string;
  outAmount: string;
  inputMint: string;
  outputMint: string;
  slippageBps?: number;
  priceImpactPct?: string;
  router?: string;
  lastValidBlockHeight?: number;
  expireAt?: string;
  errorCode?: number;
  errorMessage?: string;
  [key: string]: unknown;
}

export interface JupiterExecuteResponse {
  status: 'Success' | 'Failed';
  signature?: string;
  code: number;
  error?: string;
  totalInputAmount?: string;
  totalOutputAmount?: string;
  [key: string]: unknown;
}

export class JupiterClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = { accept: 'application/json', 'content-type': 'application/json' };
    if (this.apiKey) h['x-api-key'] = this.apiKey;
    return h;
  }

  async order(params: JupiterOrderParams): Promise<JupiterOrderResponse> {
    const qs = new URLSearchParams({ inputMint: params.inputMint, outputMint: params.outputMint, amount: params.amount });
    if (params.taker) qs.set('taker', params.taker);
    if (params.slippageBps !== undefined) qs.set('slippageBps', String(params.slippageBps));
    const res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}/order?${qs}`, { headers: this.headers() });
    const body = (await res.json().catch(() => ({}))) as JupiterOrderResponse & { error?: string };
    if (!res.ok) throw new Error(body.errorMessage || body.error || `Jupiter /order responded ${res.status}`);
    return body;
  }

  async execute(signedTransaction: string, requestId: string): Promise<JupiterExecuteResponse> {
    const res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}/execute`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ signedTransaction, requestId }),
    });
    const body = (await res.json().catch(() => ({}))) as JupiterExecuteResponse;
    if (!res.ok) throw new Error(body.error || `Jupiter /execute responded ${res.status}`);
    return body;
  }
}

export const WELL_KNOWN_MINTS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
} as const;
