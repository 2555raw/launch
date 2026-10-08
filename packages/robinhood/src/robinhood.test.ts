import { describe, expect, it } from 'vitest';
import nacl from 'tweetnacl';
import { ROBINHOOD_CAPABILITIES, RobinhoodApiError, RobinhoodCryptoClient, UnavailableRobinhoodBrokerageProvider, generateRobinhoodKeyPair, keyPairFromBase64, signRobinhoodRequest } from './index.js';

describe('Robinhood crypto request signing', () => {
  it('signs apiKey+timestamp+path+method+body with Ed25519 and base64-encodes it', () => {
    const { publicKeyBase64, privateKeyBase64 } = generateRobinhoodKeyPair();
    const creds = { apiKey: 'rh-key-123', privateKeyBase64 };
    const body = JSON.stringify({ client_order_id: 'abc', side: 'buy', type: 'market', symbol: 'BTC-USD', market_order_config: { asset_quantity: '0.0001' } });
    const headers = signRobinhoodRequest(creds, 'POST', '/api/v1/crypto/trading/orders/', body, 1700000000);
    expect(headers['x-api-key']).toBe('rh-key-123');
    expect(headers['x-timestamp']).toBe('1700000000');
    const message = `rh-key-1231700000000/api/v1/crypto/trading/orders/POST${body}`;
    const ok = nacl.sign.detached.verify(new TextEncoder().encode(message), Uint8Array.from(Buffer.from(headers['x-signature'], 'base64')), Uint8Array.from(Buffer.from(publicKeyBase64, 'base64')));
    expect(ok).toBe(true);
  });
  it('accepts both 32-byte seeds and 64-byte secret keys', () => {
    const kp = nacl.sign.keyPair();
    const fromSeed = keyPairFromBase64(Buffer.from(kp.secretKey.slice(0, 32)).toString('base64'));
    const fromSecret = keyPairFromBase64(Buffer.from(kp.secretKey).toString('base64'));
    expect(Buffer.from(fromSeed.publicKey)).toEqual(Buffer.from(fromSecret.publicKey));
    expect(() => keyPairFromBase64('AAAA')).toThrow();
  });
});

describe('RobinhoodCryptoClient', () => {
  it('calls the documented endpoints with signed headers and surfaces API errors', async () => {
    const { privateKeyBase64 } = generateRobinhoodKeyPair();
    const seen: Array<{ url: string; method: string; headers: Record<string, string>; body?: string }> = [];
    const fake = (async (url: string, init: RequestInit) => {
      seen.push({ url, method: init.method as string, headers: init.headers as Record<string, string>, body: init.body as string | undefined });
      if (url.endsWith('/api/v1/crypto/trading/accounts/')) return new Response(JSON.stringify({ account_number: 'A1', status: 'active', buying_power: '10', buying_power_currency: 'USD' }), { status: 200 });
      if (url.includes('/orders/')) return new Response(JSON.stringify({ errors: [{ detail: 'Must be a valid UUID.' }] }), { status: 400 });
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const client = new RobinhoodCryptoClient({ apiKey: 'k', privateKeyBase64 }, 'https://trading.robinhood.com', fake, () => 1700000000);
    const account = await client.getAccount();
    expect(account.account_number).toBe('A1');
    expect(seen[0].headers['x-signature']).toBeTruthy();
    await client.getBestBidAsk(['BTC-USD', 'ETH-USD']);
    expect(seen[1].url).toBe('https://trading.robinhood.com/api/v1/crypto/marketdata/best_bid_ask/?symbol=BTC-USD&symbol=ETH-USD');
    await expect(client.placeOrder({ client_order_id: 'bad', side: 'buy', type: 'market', symbol: 'BTC-USD', market_order_config: { asset_quantity: '0.0001' } })).rejects.toBeInstanceOf(RobinhoodApiError);
    expect(seen[2].method).toBe('POST');
    expect(seen[2].body).toContain('"client_order_id":"bad"');
  });
});

describe('capability matrix', () => {
  it('declares brokerage features unavailable instead of faking them', async () => {
    const brokerage = new UnavailableRobinhoodBrokerageProvider();
    await expect(brokerage.getPositions()).rejects.toThrow(/not available/);
    expect(ROBINHOOD_CAPABILITIES.filter((c) => !c.available).length).toBeGreaterThan(0);
    expect(ROBINHOOD_CAPABILITIES.find((c) => c.name.startsWith('Crypto trading'))?.available).toBe(true);
  });
});
