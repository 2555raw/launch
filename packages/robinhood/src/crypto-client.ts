import nacl from 'tweetnacl';
import type { Paged, RobinhoodAccount, RobinhoodBestBidAsk, RobinhoodCryptoProvider, RobinhoodEstimatedPrice, RobinhoodHolding, RobinhoodOrder, RobinhoodOrderRequest, RobinhoodTradingPair } from './provider.js';

export interface RobinhoodCryptoCredentials {
  apiKey: string;
  /** 32-byte Ed25519 seed OR 64-byte secret key, base64 */
  privateKeyBase64: string;
}

export class RobinhoodApiError extends Error {
  constructor(public readonly status: number, public readonly body: unknown) {
    super(`Robinhood API responded ${status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
}

/** Decodes a base64 Ed25519 private key (seed or full secret key) into a tweetnacl key pair. */
export function keyPairFromBase64(privateKeyBase64: string): nacl.SignKeyPair {
  const bytes = Uint8Array.from(Buffer.from(privateKeyBase64, 'base64'));
  if (bytes.length === 32) return nacl.sign.keyPair.fromSeed(bytes);
  if (bytes.length === 64) return nacl.sign.keyPair.fromSecretKey(bytes);
  throw new Error('Private key must be a base64-encoded 32-byte Ed25519 seed or 64-byte secret key');
}

/** Generates a fresh Ed25519 key pair in the base64 form Robinhood expects when registering an API key. */
export function generateRobinhoodKeyPair(): { publicKeyBase64: string; privateKeyBase64: string } {
  const kp = nacl.sign.keyPair();
  return { publicKeyBase64: Buffer.from(kp.publicKey).toString('base64'), privateKeyBase64: Buffer.from(kp.secretKey.slice(0, 32)).toString('base64') };
}

/**
 * Signature per docs.robinhood.com/crypto/trading#section/Authentication:
 *   message = `${apiKey}${timestamp}${path}${method}${body}`
 *   x-signature = base64(ed25519_sign(message))
 *   x-timestamp = unix seconds; x-api-key = apiKey
 */
export function signRobinhoodRequest(creds: RobinhoodCryptoCredentials, method: string, path: string, body: string, timestamp: number): Record<string, string> {
  const kp = keyPairFromBase64(creds.privateKeyBase64);
  const message = `${creds.apiKey}${timestamp}${path}${method}${body}`;
  const signature = nacl.sign.detached(new TextEncoder().encode(message), kp.secretKey);
  return {
    'x-api-key': creds.apiKey,
    'x-signature': Buffer.from(signature).toString('base64'),
    'x-timestamp': String(timestamp),
  };
}

/** Real client for the official Robinhood Crypto Trading API. */
export class RobinhoodCryptoClient implements RobinhoodCryptoProvider {
  readonly kind = 'crypto' as const;
  constructor(
    private readonly creds: RobinhoodCryptoCredentials,
    private readonly baseUrl: string = 'https://trading.robinhood.com',
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly now: () => number = () => Math.floor(Date.now() / 1000),
  ) {}

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const bodyStr = body === undefined ? '' : JSON.stringify(body);
    const headers = { ...signRobinhoodRequest(this.creds, method, path, bodyStr, this.now()), 'Content-Type': 'application/json; charset=utf-8', accept: 'application/json' };
    const res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}${path}`, { method, headers, body: method === 'POST' ? bodyStr : undefined });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      /* keep text */
    }
    if (!res.ok) throw new RobinhoodApiError(res.status, parsed);
    return parsed as T;
  }

  getAccount() {
    return this.request<RobinhoodAccount>('GET', '/api/v1/crypto/trading/accounts/');
  }
  getHoldings(assetCodes?: string[]) {
    const qs = assetCodes?.length ? '?' + assetCodes.map((c) => `asset_code=${encodeURIComponent(c)}`).join('&') : '';
    return this.request<Paged<RobinhoodHolding>>('GET', `/api/v1/crypto/trading/holdings/${qs}`);
  }
  getTradingPairs(symbols?: string[]) {
    const qs = symbols?.length ? '?' + symbols.map((s) => `symbol=${encodeURIComponent(s)}`).join('&') : '';
    return this.request<Paged<RobinhoodTradingPair>>('GET', `/api/v1/crypto/trading/trading_pairs/${qs}`);
  }
  getBestBidAsk(symbols: string[]) {
    const qs = '?' + symbols.map((s) => `symbol=${encodeURIComponent(s)}`).join('&');
    return this.request<{ results: RobinhoodBestBidAsk[] }>('GET', `/api/v1/crypto/marketdata/best_bid_ask/${qs}`);
  }
  getEstimatedPrice(symbol: string, side: 'bid' | 'ask' | 'both', quantities: string[]) {
    const qs = `?symbol=${encodeURIComponent(symbol)}&side=${side}&quantity=${encodeURIComponent(quantities.join(','))}`;
    return this.request<{ results: RobinhoodEstimatedPrice[] }>('GET', `/api/v1/crypto/marketdata/estimated_price/${qs}`);
  }
  placeOrder(order: RobinhoodOrderRequest) {
    return this.request<RobinhoodOrder>('POST', '/api/v1/crypto/trading/orders/', order);
  }
  getOrders() {
    return this.request<Paged<RobinhoodOrder>>('GET', '/api/v1/crypto/trading/orders/');
  }
  getOrder(orderId: string) {
    return this.request<RobinhoodOrder>('GET', `/api/v1/crypto/trading/orders/${orderId}/`);
  }
  cancelOrder(orderId: string) {
    return this.request<unknown>('POST', `/api/v1/crypto/trading/orders/${orderId}/cancel/`);
  }
}
