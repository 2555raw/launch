import { SITE } from '../config/site';
import { useEffect, useState } from 'react';
import { formatEther, type Address } from 'viem';
import { PageHead } from '../components/bits';
import { chainMeta, DEPLOYMENTS, KNOWN_CHAINS, type Deployment } from '../config/chains';
import {
  deployPad,
  forgetState,
  listedCount,
  loadState,
  parseTokensParam,
  publicClientFor,
  realTokensOf,
  steps,
  txCount,
  type DeployState,
  type RealToken,
} from '../lib/deployPad';
import { useWallet } from '../wallet/WalletProvider';

/** Robinhood Chain, real money: the desk lists the dollar and ether tokens that trade
 *  there (shared/real-tokens.json). ?chain=<id> picks another network the site knows
 *  (its testnet, a local node); ?tokens=USD:0x…,ETH:0x… lists those tokens on a chain
 *  that has none on file. */
function target(): { chain: number; tokens: RealToken[] } {
  const q = new URLSearchParams(location.search);
  const asked = Number(q.get('chain'));
  const chain = KNOWN_CHAINS.some((c) => c.id === asked) ? asked : 4663;
  const given = parseTokensParam(q.get('tokens'));
  return { chain, tokens: given.length ? given : realTokensOf(chain) };
}

/** Puts the pad on chain from the owner's own wallet: every transaction is signed there,
 *  and no key ever leaves it. Not linked from the menu. */
export default function Deploy() {
  const [{ chain: TARGET, tokens: TOKENS }] = useState(target);
  const wallet = useWallet();
  const meta = chainMeta(TARGET);
  const real = TOKENS.length > 0;
  const owner = wallet.address as Address | undefined;
  const [state, setState] = useState<DeployState>({});
  const [listed, setListed] = useState(0);
  const [balance, setBalance] = useState<bigint>();
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const [record, setRecord] = useState<Deployment>();
  const [copied, setCopied] = useState(false);
  const onChain = wallet.chainId === TARGET;
  const live = DEPLOYMENTS[TARGET];

  // what an earlier run already did, and the gas money there is
  useEffect(() => {
    if (!owner) return;
    const s = loadState(TARGET, owner);
    setState(s);
    const pc = publicClientFor(TARGET);
    pc.getBalance({ address: owner }).then(setBalance, () => setBalance(undefined));
    import('@shared/artifacts.json')
      .then((m) => listedCount(pc, m.default as never, s.desk))
      .then(setListed, () => setListed(0));
  }, [owner, TARGET]);

  const run = async () => {
    if (!owner) return;
    setErr(undefined);
    setBusy(true);
    try {
      if (!onChain) await wallet.switchChain(TARGET);
      const client = wallet.walletClient(TARGET);
      if (!client) throw new Error('Connect your wallet first.');
      const rec = await deployPad({
        chainId: TARGET,
        wallet: client,
        owner,
        tokens: TOKENS,
        onProgress: (line, s, n) => {
          setState(s);
          setListed(n);
          setLog((l) => [...l, line]);
        },
      });
      setRecord(rec);
      setLog((l) => [...l, 'Done. The pad is on chain.']);
    } catch (e) {
      const m = (e as { shortMessage?: string; message?: string }).shortMessage || (e as Error).message || String(e);
      setErr(/reject|denied/i.test(m) ? 'The transaction was rejected in the wallet. Press the button again to carry on from here.' : m);
    } finally {
      setBusy(false);
    }
  };

  const json = record ? JSON.stringify({ [record.chainId]: record }, null, 2) : '';
  const list = steps(state, listed, TARGET, TOKENS);
  const started = list.some((s) => s.done);
  const tokenNames = TOKENS.map((t) => `${t.symbol} as ${t.code}`).join(' and ');

  return (
    <div className="wrap narrow" style={{ maxWidth: 860 }}>
      <PageHead
        kicker="For the owner"
        title={`Put ${SITE.name} on chain`}
        lead={`This deploys the currency desk, the launchpad and the router to ${meta.name} from your own wallet; every coin launched on it opens as a Uniswap V3 pool with its whole supply locked in. ${
          real ? `The desk lists ${tokenNames}, the tokens that trade there. ` : ''
        }You sign ${txCount(TARGET, TOKENS)} transactions there; no private key is shared with anyone.`}
      />

      {live && (
        <div className="callout" style={{ marginBottom: 18 }}>
          <b>This site already runs on {live.name}</b> (launchpad {live.launchpad}). Deploying again makes a second, separate pad.
        </div>
      )}

      <div className="panel" data-solid>
        <ol className="deploy-steps">
          <li>
            <b>A wallet with a little ETH on {meta.name}.</b>{' '}
            {meta.testnet ? (
              <>
                Test ETH is free
                {meta.faucet ? (
                  <>
                    {' '}
                    from the{' '}
                    <a href={meta.faucet} target="_blank" rel="noopener noreferrer">
                      faucet
                    </a>
                  </>
                ) : null}
                ; a few hundredths of an ETH covers every transaction.
              </>
            ) : (
              <>
                A few hundredths of an ETH covers every transaction; it gets there over the chain’s bridge
                {meta.bridge ? (
                  <>
                    {' '}
                    (
                    <a href={meta.bridge} target="_blank" rel="noopener noreferrer">
                      how to bridge
                    </a>
                    )
                  </>
                ) : null}
                , or straight from a wallet or exchange that sends to {meta.name}.
              </>
            )}
            {owner && balance !== undefined && (
              <span className={`hint ${balance === 0n ? 'warn' : ''}`} style={{ display: 'block', marginTop: 4 }}>
                {owner.slice(0, 6)}…{owner.slice(-4)} holds {Number(formatEther(balance)).toFixed(4)} ETH on {meta.name}.
              </span>
            )}
          </li>
          <li>
            <b>Deploy.</b> Your wallet asks you to confirm each transaction; if you close the page or reject one, press the button again and it carries on
            where it stopped.
          </li>
          <li>
            <b>Send the result to Claude</b> (or paste it into <code>web/src/generated/deployments.json</code> and push). Once it is in, the site talks to these
            contracts.
          </li>
        </ol>

        <div className="deploy-progress">
          {list.map((s) => (
            <div key={s.key} className="check">
              <span className={`check-mark ${s.done ? 'ok' : 'wait'}`}>{s.done ? '✓' : '·'}</span>
              <div>{s.label}</div>
            </div>
          ))}
        </div>

        {!owner ? (
          <button className="btn btn-primary" onClick={wallet.openModal}>
            Connect wallet
          </button>
        ) : (
          <button className="btn btn-primary" onClick={run} disabled={busy || balance === 0n}>
            {busy ? 'Deploying…' : !onChain ? `Switch to ${meta.name} and deploy` : started ? 'Carry on deploying' : 'Deploy'}
          </button>
        )}
        {started && !busy && !record && owner && (
          <button
            className="btn"
            style={{ marginLeft: 10 }}
            onClick={() => {
              forgetState(TARGET, owner);
              setState({});
              setListed(0);
              setLog([]);
            }}
          >
            Start over
          </button>
        )}
        {err && (
          <div className="callout warn" style={{ marginTop: 14 }}>
            {err}
          </div>
        )}
        {log.length > 0 && (
          <pre className="deploy-log mono small" aria-live="polite">
            {log.join('\n')}
          </pre>
        )}
      </div>

      {record && (
        <div className="panel" style={{ marginTop: 18 }}>
          <span className="verdict ok">Deployed on {record.name}</span>
          <p className="muted small" style={{ margin: '10px 0' }}>
            Send this to Claude, or put it in <code>web/src/generated/deployments.json</code>:
          </p>
          <pre className="deploy-log mono small">{json}</pre>
          <button
            className="btn btn-primary"
            onClick={() => {
              navigator.clipboard?.writeText(json).then(() => setCopied(true));
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          {meta.explorer && (
            <a className="btn" style={{ marginLeft: 10 }} href={`${meta.explorer}/address/${record.launchpad}`} target="_blank" rel="noopener noreferrer">
              See the launchpad on the explorer
            </a>
          )}
        </div>
      )}

      {real ? (
        <div className="callout" style={{ marginTop: 18 }}>
          <b>This is real money.</b> The contracts are tested (unit, fuzz and invariant tests) but have not been audited by an outside firm; the wallet
          that deploys owns the pad and the desk, keeps the rates and receives the protocol fees. Coins pair with {tokenNames} and open as Uniswap
          pools the pad can never withdraw from; between those tokens the swap page routes through Uniswap's own pools, since the desk holds no
          reserve. The rates the desk starts with are today’s; the keeper (you, until you appoint one) posts the next ones.
        </div>
      ) : (
        <div className="callout" style={{ marginTop: 18 }}>
          <b>Test money.</b> These contracts are tested (unit, fuzz and invariant tests), not audited. On {meta.name} the currencies are test tokens
          anyone can take from the desk’s faucet.
        </div>
      )}
    </div>
  );
}
