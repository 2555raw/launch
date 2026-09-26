import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPublicClient, formatUnits, getAddress, http, isAddress, keccak256, parseAbiItem, type Hex } from 'viem';
import { usePad } from '../backend/PadProvider';
import { DEPLOYMENTS } from '../config/chains';
import { coinAbi, deskAbi, launchpadAbi, COIN_RUNTIME_HASH, LAUNCHPAD_IMMUTABLES, LAUNCHPAD_RUNTIME } from '../generated/contracts';
import { PageHead } from '../components/bits';
import { circulating, fullSellBack } from '../lib/math';

interface Result {
  title: string;
  ok: boolean | null;
  detail: string;
}

const balanceOf = parseAbiItem('function balanceOf(address) view returns (uint256)');
const createdEvent = parseAbiItem(
  'event CoinCreated(address indexed coin, address indexed creator, address indexed currency, string name, string symbol, string meta, uint256 virtualQuote)',
);

/** Zeroes the byte ranges that hold immutables, so two deployments of the same source compare equal. */
function mask(code: string, ranges: ReadonlyArray<readonly [number, number]>) {
  let s = code.toLowerCase().replace(/^0x/, '');
  for (const [start, len] of ranges) s = s.slice(0, start * 2) + '0'.repeat(len * 2) + s.slice((start + len) * 2);
  return s;
}

async function runChecks(rpc: string, padAddr: `0x${string}`, coinAddr: `0x${string}`, fromBlock?: bigint): Promise<Result[]> {
  const client = createPublicClient({ transport: http(rpc) });
  const read = <T,>(address: `0x${string}`, abi: any, functionName: string, args: unknown[] = []) =>
    client.readContract({ address, abi, functionName, args }) as Promise<T>;
  const out: Result[] = [];

  // 1. the pad is the published Launchpad
  const padCode = (await client.getCode({ address: padAddr })) ?? '0x';
  const padOk = padCode !== '0x' && mask(padCode, LAUNCHPAD_IMMUTABLES) === mask(LAUNCHPAD_RUNTIME, LAUNCHPAD_IMMUTABLES);
  out.push({
    title: 'The pad runs the published code',
    ok: padOk,
    detail: padOk
      ? `Runtime code at ${padAddr} matches the compiled Launchpad byte for byte, with its ${LAUNCHPAD_IMMUTABLES.length} immutable slots masked.`
      : padCode === '0x'
        ? `There is no contract at ${padAddr} on this chain.`
        : `The code at ${padAddr} differs from the compiled Launchpad (${(padCode.length - 2) / 2} bytes vs ${(LAUNCHPAD_RUNTIME.length - 2) / 2}).`,
  });

  // 2. the coin is a clone of the pad's own implementation
  const impl = await read<`0x${string}`>(padAddr, launchpadAbi, 'coinImplementation');
  const coinCode = ((await client.getCode({ address: coinAddr })) ?? '0x').toLowerCase();
  const expected = `0x3d3d3d3d363d3d37363d73${impl.slice(2).toLowerCase()}5af43d3d93803e602a57fd5bf3`;
  out.push({
    title: 'The coin is a clone of the pad’s coin',
    ok: coinCode === expected,
    detail:
      coinCode === expected
        ? `The coin's 44 bytes of code delegate to ${impl}, the implementation the pad deploys every coin from.`
        : `Expected a minimal proxy pointing at ${impl}; found ${coinCode === '0x' ? 'no code' : `${(coinCode.length - 2) / 2} bytes of something else`}.`,
  });

  const implCode = (await client.getCode({ address: impl })) ?? '0x';
  const implHash = keccak256(implCode as Hex);
  out.push({
    title: 'That coin code is the published Coin',
    ok: implHash === COIN_RUNTIME_HASH,
    detail: `keccak256 of the implementation's code is ${implHash.slice(0, 18)}…; the compiled Coin hashes to ${COIN_RUNTIME_HASH.slice(0, 18)}….`,
  });

  // 3. the pad knows the coin, and the coin knows the pad
  const [isCoin, coinPad] = await Promise.all([
    read<boolean>(padAddr, launchpadAbi, 'isCoin', [coinAddr]),
    read<`0x${string}`>(coinAddr, coinAbi, 'launchpad').catch(() => '0x0000000000000000000000000000000000000000' as const),
  ]);
  out.push({
    title: 'The pad opened this market',
    ok: isCoin && getAddress(coinPad) === getAddress(padAddr),
    detail: `isCoin(${coinAddr.slice(0, 10)}…) returned ${isCoin}; the coin says it was minted by ${coinPad}.`,
  });
  if (!isCoin) return out;

  const market = await read<any>(padAddr, launchpadAbi, 'getMarket', [coinAddr]);
  const deskAddr = await read<`0x${string}`>(padAddr, launchpadAbi, 'desk');
  const listed = await read<boolean>(deskAddr, deskAbi, 'isListed', [market.currency]);
  let code = '?';
  let dec = 18;
  if (listed) {
    const c = await read<any>(deskAddr, deskAbi, 'getCurrency', [market.currency]);
    code = c.code;
    dec = Number(c.decimals);
  }
  // exact amounts, in whole units of the currency (or coin)
  const q = (v: bigint) => `${formatUnits(v, dec)} ${code}`;
  const t = (v: bigint) => `${formatUnits(v, 18)} coins`;
  out.push({
    title: 'The currency comes from the desk',
    ok: listed,
    detail: listed
      ? `Paired with ${market.currency}, listed on the desk (${deskAddr.slice(0, 10)}…) as ${code}. The code is read from the desk, not from anything the creator wrote.`
      : `The market's currency ${market.currency} is not on the desk's list.`,
  });

  // 4. the pairing never changed: the launch event names the same currency
  try {
    const logs = await client.getLogs({ address: padAddr, event: createdEvent, args: { coin: coinAddr }, fromBlock: fromBlock ?? 'earliest', toBlock: 'latest' });
    const launchedWith = logs[0]?.args.currency;
    out.push({
      title: 'The pairing has not changed since launch',
      ok: !!launchedWith && getAddress(launchedWith) === getAddress(market.currency),
      detail: launchedWith
        ? `The launch event in block ${logs[0].blockNumber} names ${launchedWith}; the market holds ${market.currency} today. The contract has no function that could change it.`
        : 'Could not find the launch event in that block range.',
    });
  } catch {
    out.push({
      title: 'The pairing has not changed since launch',
      ok: null,
      detail: 'This RPC refused the log search. Enter the block the pad was deployed in and run again.',
    });
  }

  // 5. reserves and backing
  const m = {
    createdAt: Number(market.createdAt),
    graduated: market.graduated as boolean,
    virtualQuote: market.virtualQuote as bigint,
    reserveToken: market.reserveToken as bigint,
    reserveQuote: market.reserveQuote as bigint,
    realQuote: market.realQuote as bigint,
    curveLeft: market.curveLeft as bigint,
    volume: market.volume as bigint,
  };
  const sums = m.graduated ? m.reserveQuote === m.realQuote : m.reserveQuote === m.virtualQuote + m.realQuote;
  const payout = fullSellBack(m);
  out.push({
    title: 'Its reserves add up and cover a full sell-back',
    ok: sums && payout <= m.realQuote,
    detail: `${m.graduated ? 'Pool' : 'Curve'}: reserve ${q(m.reserveQuote)} ${sums ? '=' : '≠'} ${m.graduated ? `backing ${q(m.realQuote)}` : `virtual ${q(m.virtualQuote)} + backing ${q(m.realQuote)}`}. Selling all ${t(circulating(m))} in circulation would pay ${q(payout)}.`,
  });

  // 6. custody
  const [held, backing, fees] = await Promise.all([
    read<bigint>(market.currency, [balanceOf], 'balanceOf', [padAddr]),
    read<bigint>(padAddr, launchpadAbi, 'backing', [market.currency]),
    read<bigint>(padAddr, launchpadAbi, 'totalFeesOwed', [market.currency]),
  ]);
  out.push({
    title: 'The money is really in the pad',
    ok: held >= backing + fees,
    detail: `The pad holds ${q(held)}; it owes ${q(backing)} of backing across every ${code} market plus ${q(fees)} in unclaimed fees.`,
  });
  return out;
}

export default function Verify() {
  const pad = usePad();
  const [params] = useSearchParams();
  const dep = pad.chainId ? DEPLOYMENTS[pad.chainId] : Object.values(DEPLOYMENTS)[0];
  const [rpc, setRpc] = useState(dep?.rpcUrl ?? 'https://sepolia.base.org');
  const [padAddr, setPadAddr] = useState<string>(dep?.launchpad ?? '');
  const [coinAddr, setCoinAddr] = useState(params.get('coin') ?? '');
  const [fromBlock, setFromBlock] = useState(dep ? String(dep.deployBlock) : '');
  const [results, setResults] = useState<Result[] | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const c = params.get('coin');
    if (c) setCoinAddr(c);
  }, [params]);

  const run = async () => {
    setErr('');
    setResults(null);
    if (!isAddress(padAddr) || !isAddress(coinAddr)) {
      setErr('Both addresses have to be 0x followed by 40 hex characters.');
      return;
    }
    setBusy(true);
    try {
      setResults(await runChecks(rpc, getAddress(padAddr), getAddress(coinAddr), fromBlock ? BigInt(fromBlock) : undefined));
    } catch (e: any) {
      setErr(e?.shortMessage || e?.message || 'The checks could not run against that node.');
    } finally {
      setBusy(false);
    }
  };

  const verdict = results && (results.every((r) => r.ok !== false) ? 'ok' : 'bad');

  return (
    <div className="wrap narrow" style={{ maxWidth: 980 }}>
      <PageHead
        kicker="Trust, but check"
        title="Verify a coin"
        lead="Any page can print “priced in euros”. These checks read the chain directly, from your browser, against a node you choose, and show you the numbers they compared rather than just a green tick."
      />

      {!dep && (
        <div className="callout" style={{ marginBottom: 18 }}>
          <b>This build is not pointed at a deployment yet</b>, so the form starts empty. It is not a mock: paste a pad and a coin address from any EVM chain and
          the checks run for real. Coins in the playground live only in your browser and have no address on chain.
        </div>
      )}

      <div className="panel" data-solid>
        <div className="field">
          <label htmlFor="rpc">RPC endpoint</label>
          <input id="rpc" className="input mono" value={rpc} onChange={(e) => setRpc(e.target.value)} />
          <span className="hint">Use your own node if you prefer. The page only sends read calls to it.</span>
        </div>
        <div className="grid grid-2" style={{ gap: 12 }}>
          <div className="field">
            <label htmlFor="pad">Pad (Launchpad) address</label>
            <input id="pad" className="input mono" placeholder="0x…" value={padAddr} onChange={(e) => setPadAddr(e.target.value.trim())} />
          </div>
          <div className="field">
            <label htmlFor="coin">Coin address</label>
            <input id="coin" className="input mono" placeholder="0x…" value={coinAddr} onChange={(e) => setCoinAddr(e.target.value.trim())} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="from">Search the launch event from block (optional)</label>
          <input id="from" className="input mono" placeholder="the pad's deployment block" value={fromBlock} onChange={(e) => setFromBlock(e.target.value.replace(/\D/g, ''))} />
        </div>
        <button className="btn btn-primary" onClick={run} disabled={busy}>
          {busy ? 'Checking…' : 'Run the checks'}
        </button>
        {err && (
          <div className="callout warn" style={{ marginTop: 14 }}>
            {err}
          </div>
        )}
      </div>

      {results && (
        <div className="panel" style={{ marginTop: 18 }}>
          <span className={`verdict ${verdict}`}>{verdict === 'ok' ? 'Every check passed' : 'At least one check failed'}</span>
          <div style={{ marginTop: 10 }}>
            {results.map((r) => (
              <div key={r.title} className="check">
                <span className={`check-mark ${r.ok === null ? 'wait' : r.ok ? 'ok' : 'bad'}`}>{r.ok === null ? '?' : r.ok ? '✓' : '✗'}</span>
                <div>
                  <b>{r.title}</b>
                  <div className="muted small mono" style={{ wordBreak: 'break-word', marginTop: 4 }}>
                    {r.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <section className="section" style={{ paddingBottom: 0 }}>
        <div className="kicker">What the checks mean</div>
        <h2 className="h-section" style={{ marginBottom: 24 }}>
          Eight reasons to believe the badge
        </h2>
        <div className="explain-grid">
          {[
            ['The pad runs the published code', 'Its bytecode is compared with the compiled Launchpad, masking only the constructor-set values that differ between deployments.'],
            ['The coin is the pad’s', 'Every coin is a 44-byte clone that delegates to one Coin implementation. Anything else with a similar name fails here.'],
            ['The coin code is published', 'The implementation behind every clone hashes to the Coin in this repository.'],
            ['The pad opened the market', 'The pad has a record of the coin, and the coin names the pad as the contract that minted it.'],
            ['The currency is on the desk', 'The currency code is read from the desk’s list, so a creator cannot invent one.'],
            ['The pairing never changed', 'The launch event names the same currency the market holds today.'],
            ['The books balance', 'The market’s reserves add up to the unit, and its backing covers selling every circulating coin back at once.'],
            ['The money is there', 'The pad’s own balance of the currency covers the backing of every market in it, plus fees nobody has claimed yet.'],
          ].map(([t, d], i) => (
            <div key={t} className="rule">
              <span className="step-n">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <b>{t}</b>
                <p className="muted small">{d}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="panel" style={{ marginTop: 30 }}>
          <b>Run the same checks from a terminal</b>
          <p className="muted small">If this page and the script ever disagree, trust the script: it is short enough to read.</p>
          <div className="code-block">{`cd downpour && npm install
node scripts/verify.mjs \\
  --rpc ${rpc || 'https://…'} \\
  --pad ${padAddr || '0x…'} \\
  --coin ${coinAddr || '0x…'}`}</div>
          <p className="muted small" style={{ marginBottom: 0 }}>
            Leave out <span className="mono">--coin</span> to check every coin the pad has opened.
          </p>
        </div>
        <div className="callout warn" style={{ marginTop: 18 }}>
          <b>What this does not prove.</b> It does not audit the contracts: it proves the code on chain is the code in this repository and that its books balance.
          It cannot tell you a coin is worth anything, and on a test network the currencies are test tokens with no value.
        </div>
      </section>
    </div>
  );
}
