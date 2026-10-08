'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Keypair } from '@solana/web3.js';
import { usePublicClient, useWalletClient } from 'wagmi';
import type { Abi, Hex } from 'viem';
import { AlertTriangle, CheckCircle2, Circle, Rocket, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { buildCreateTokenTransaction } from '@launch/solana';
import { robinhoodExplorerTxUrl, solanaExplorerTxUrl } from '@launch/config/chains';
import type { ProjectDTO } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { ROBINHOOD_CHAIN_NETWORK, SOLANA_NETWORK } from '@/lib/config';
import { robinhoodChain } from '@/components/providers';
import { toast } from '@/components/ui/toast';
import { Spinner, shortAddr } from '@/components/ui/primitives';
import { walletErrorMessage } from '@/components/wallet/encoding';
import { ChainBadge, ExtLink, formatWhole } from '../common';
import { useChainWallet } from './step-chain';
import type { PreparedLaunch } from './state';

type Phase = 'idle' | 'preparing' | 'building' | 'signing' | 'sent' | 'confirming' | 'verifying' | 'published' | 'error';
const ORDER: Phase[] = ['building', 'signing', 'sent', 'confirming', 'verifying', 'published'];
const LABEL: Record<Phase, string> = {
  idle: '',
  preparing: 'Preparing metadata',
  building: 'Building transaction',
  signing: 'Awaiting wallet signature',
  sent: 'Transaction sent',
  confirming: 'Confirming on chain',
  verifying: 'Verifying on server',
  published: 'Published',
  error: 'Failed',
};

interface SentTx {
  signature: string;
  address: string;
}

function storageKey(id: string) {
  return `launch:tx:${id}`;
}
function loadSent(id: string): SentTx | null {
  try {
    const raw = sessionStorage.getItem(storageKey(id));
    return raw ? (JSON.parse(raw) as SentTx) : null;
  } catch {
    return null;
  }
}
function saveSent(id: string, tx: SentTx | null) {
  try {
    if (tx) sessionStorage.setItem(storageKey(id), JSON.stringify(tx));
    else sessionStorage.removeItem(storageKey(id));
  } catch {
    /* ignore */
  }
}

export function StepSign({ project, fixedSupply, revokeFreeze, prepared, onPrepared, onPublished, onBack }: { project: ProjectDTO; fixedSupply: boolean; revokeFreeze: boolean; prepared: PreparedLaunch | null; onPrepared: (p: PreparedLaunch) => void; onPublished: (p: ProjectDTO) => void; onBack: () => void }) {
  const qc = useQueryClient();
  const sol = project.chain === 'SOLANA';
  const { connection } = useConnection();
  const solWallet = useWallet();
  const { data: walletClient } = useWalletClient({ chainId: robinhoodChain.id });
  const publicClient = usePublicClient({ chainId: robinhoodChain.id });
  const { address, connected, linked, evm } = useChainWallet(project.chain);

  const [phase, setPhase] = useState<Phase>(project.status === 'VERIFYING' ? 'verifying' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<SentTx | null>(() => loadSent(project.id));
  const [rentLamports, setRentLamports] = useState<number | null>(null);
  const [verifyFailed, setVerifyFailed] = useState(false);
  const preparing = useRef(false);

  const current = prepared && prepared.project.id === project.id ? prepared : null;
  const explorerTx = (sig: string) => (sol ? solanaExplorerTxUrl(sig, SOLANA_NETWORK) : robinhoodExplorerTxUrl(sig, ROBINHOOD_CHAIN_NETWORK));

  // Resume: the metadata URI is not part of the project DTO, so re-run prepare (idempotent) after a refresh.
  useEffect(() => {
    if (current || preparing.current || project.status === 'PUBLISHED' || project.status === 'VERIFYING') return;
    preparing.current = true;
    setPhase('preparing');
    api<PreparedLaunch>(`/launchpad/projects/${project.id}/prepare`, { method: 'POST' })
      .then((p) => {
        onPrepared(p);
        setPhase('idle');
      })
      .catch((e) => {
        setError(errorMessage(e));
        setPhase('error');
      })
      .finally(() => {
        preparing.current = false;
      });
  }, [current, project.id, project.status, onPrepared]);

  // If the server is mid-verification (e.g. after a refresh), poll until it settles.
  useEffect(() => {
    if (project.status !== 'VERIFYING') return;
    const t = setInterval(() => void qc.invalidateQueries({ queryKey: ['project', project.id] }), 3000);
    return () => clearInterval(t);
  }, [project.status, project.id, qc]);
  useEffect(() => {
    if (project.status === 'PUBLISHED') {
      setPhase('published');
      saveSent(project.id, null);
      onPublished(project);
    }
  }, [project, onPublished]);

  const submit = useCallback(
    async (tx: SentTx) => {
      setPhase('verifying');
      setVerifyFailed(false);
      try {
        const res = await api<{ project: ProjectDTO }>(`/launchpad/projects/${project.id}/submit`, { method: 'POST', json: tx });
        qc.setQueryData(['project', project.id], (old: { project: ProjectDTO; transactions: unknown[] } | undefined) => ({ project: res.project, transactions: old?.transactions ?? [] }));
        void qc.invalidateQueries({ queryKey: ['launchpad', 'mine'] });
        saveSent(project.id, null);
        setPhase('published');
        toast.success('Token published', `${res.project.name} is live on ${sol ? 'Solana' : 'Robinhood Chain'}.`);
        onPublished(res.project);
      } catch (e) {
        setVerifyFailed(true);
        setError(errorMessage(e));
        setPhase('error');
        void qc.invalidateQueries({ queryKey: ['project', project.id] });
      }
    },
    [project.id, qc, sol, onPublished],
  );

  const launchSolana = useCallback(async () => {
    if (!current) throw new Error('Launch is not prepared yet');
    if (!solWallet.publicKey || !solWallet.signTransaction) throw new Error('Connect a Solana wallet that supports transaction signing');
    setPhase('building');
    const mintKeypair = Keypair.generate();
    const built = await buildCreateTokenTransaction({
      connection,
      payer: solWallet.publicKey,
      mintKeypair,
      name: project.name,
      symbol: project.symbol,
      uri: current.metadataUri,
      decimals: project.decimals,
      totalSupply: BigInt(project.totalSupply),
      revokeMintAuthority: fixedSupply,
      revokeFreezeAuthority: revokeFreeze,
    });
    setRentLamports(built.rentLamports);
    setPhase('signing');
    const signed = await solWallet.signTransaction(built.transaction);
    const signature = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
    const tx = { signature, address: built.mint.toBase58() };
    setSent(tx);
    saveSent(project.id, tx);
    setPhase('sent');
    setPhase('confirming');
    const conf = await connection.confirmTransaction({ signature, blockhash: built.transaction.recentBlockhash as string, lastValidBlockHeight: built.lastValidBlockHeight }, 'confirmed');
    if (conf.value.err) throw new Error(`Transaction failed on chain: ${JSON.stringify(conf.value.err)}`);
    await submit(tx);
  }, [current, solWallet, connection, project, fixedSupply, revokeFreeze, submit]);

  const launchRobinhood = useCallback(async () => {
    if (!current) throw new Error('Launch is not prepared yet');
    if (!walletClient || !evm.address) throw new Error('Connect an EVM wallet first');
    if (!evm.onRobinhood) throw new Error('Switch your wallet to Robinhood Chain first');
    if (!publicClient) throw new Error('Robinhood Chain RPC client unavailable');
    setPhase('building');
    const cfg = await api<{ erc20: { abi: unknown; bytecode: string } }>('/launchpad/config');
    const supplyRaw = BigInt(project.totalSupply) * 10n ** BigInt(project.decimals);
    setPhase('signing');
    const hash = await walletClient.deployContract({
      abi: cfg.erc20.abi as Abi,
      bytecode: cfg.erc20.bytecode as Hex,
      args: [project.name, project.symbol, project.decimals, supplyRaw, evm.address, fixedSupply],
      chain: robinhoodChain,
      account: evm.address,
    });
    setPhase('sent');
    setSent({ signature: hash, address: '' });
    setPhase('confirming');
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error('The deployment transaction reverted');
    if (!receipt.contractAddress) throw new Error('The receipt has no contract address');
    const tx = { signature: hash, address: receipt.contractAddress };
    setSent(tx);
    saveSent(project.id, tx);
    await submit(tx);
  }, [current, walletClient, evm.address, evm.onRobinhood, publicClient, project, fixedSupply, submit]);

  const launch = async () => {
    setError(null);
    setVerifyFailed(false);
    try {
      if (sol) await launchSolana();
      else await launchRobinhood();
    } catch (e) {
      // submit() reports its own failures; anything caught here happened before or during the on-chain part.
      setError(walletErrorMessage(e));
      setPhase('error');
      void qc.invalidateQueries({ queryKey: ['project', project.id] });
    }
  };

  const running = ['preparing', 'building', 'signing', 'sent', 'confirming', 'verifying'].includes(phase);
  const reached = (p: Phase) => {
    const idx = ORDER.indexOf(p);
    const cur = ORDER.indexOf(phase === 'error' ? (sent ? (verifyFailed ? 'verifying' : 'confirming') : 'building') : phase);
    if (phase === 'published') return 'done';
    if (phase === 'error') return idx < cur ? 'done' : idx === cur ? 'error' : 'pending';
    if (phase === 'idle' || phase === 'preparing') return 'pending';
    return idx < cur ? 'done' : idx === cur ? 'active' : 'pending';
  };
  const canLaunch = !!current && connected && linked && (sol ? !!solWallet.signTransaction : !!walletClient && evm.onRobinhood) && !running && phase !== 'published';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-white">Sign &amp; create</h2>
        <p className="mt-1 text-sm text-slate-400">{sol ? 'One transaction creates the Token-2022 mint with metadata, your token account and mints the whole supply to it.' : 'Your wallet deploys the ERC-20 contract. The full supply is minted to the deployer address in the constructor.'}</p>
      </div>

      <div className="card grid gap-3 p-4 sm:grid-cols-2">
        <div className="text-sm">
          <div className="text-xs uppercase tracking-wide text-slate-500">Token</div>
          <div className="font-display font-semibold text-white">
            {project.name} <span className="font-mono text-slate-400">${project.symbol}</span>
          </div>
          <div className="text-xs text-slate-400">
            {formatWhole(project.totalSupply)} supply · {project.decimals} decimals · {fixedSupply ? 'fixed supply' : 'mintable'}
            {sol && (revokeFreeze ? ' · freeze revoked' : '')}
          </div>
        </div>
        <div className="text-sm">
          <div className="text-xs uppercase tracking-wide text-slate-500">Network &amp; wallet</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <ChainBadge chain={project.chain} network={project.network} />
            {address ? <span className="badge font-mono">{shortAddr(address, 6)}</span> : <span className="text-gold-300">No wallet connected</span>}
            {address && !linked && <span className="text-xs text-rose-300">not linked</span>}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gold-500/30 bg-gold-500/5 p-3 text-sm text-slate-300">
        <div className="flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-gold-400" />
          <div>
            <span className="font-semibold text-gold-300">Estimated cost.</span>{' '}
            {sol ? (
              <>
                Your wallet pays the mint account rent{rentLamports !== null ? ` (${(rentLamports / 1e9).toFixed(4)} SOL)` : ''}, the associated token account rent and network fees.{' '}
                {SOLANA_NETWORK === 'mainnet-beta' ? <span className="text-gold-300">This is Solana mainnet: real SOL will be spent.</span> : <span>This server runs on {SOLANA_NETWORK}.</span>}
              </>
            ) : (
              <>
                Your wallet pays the gas for the contract deployment in ETH on Robinhood Chain{ROBINHOOD_CHAIN_NETWORK === 'mainnet' ? <span className="text-gold-300"> (mainnet: real funds)</span> : ' testnet'}. The wallet shows the exact gas estimate before you confirm.
              </>
            )}
          </div>
        </div>
      </div>

      {!sol && connected && !evm.onRobinhood && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm">
          <span className="text-rose-200">Your wallet is on another network.</span>
          <button className="btn-secondary text-xs" onClick={() => void evm.switchToRobinhood()} disabled={evm.switching}>
            {evm.switching && <Spinner />} Switch to Robinhood Chain
          </button>
        </div>
      )}
      {connected && !linked && <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-200">The connected wallet is not linked to your account. Go back to step 1 to link it, or switch to a linked wallet.</div>}
      {current && (
        <div className="text-xs text-slate-500">
          Metadata URI: <ExtLink href={current.metadataUri}>{current.metadataUri}</ExtLink>
        </div>
      )}

      <div className="card p-4">
        <ol className="space-y-2">
          {ORDER.map((p) => {
            const st = reached(p);
            return (
              <li key={p} className={clsx('flex items-start gap-3 text-sm', st === 'pending' && 'text-slate-500', st === 'active' && 'text-ember-300', st === 'done' && 'text-slate-200', st === 'error' && 'text-rose-300')}>
                <span className="mt-0.5">{st === 'done' ? <CheckCircle2 size={16} className="text-mint-400" /> : st === 'active' ? <Spinner className="text-ember-400" /> : st === 'error' ? <XCircle size={16} /> : <Circle size={16} />}</span>
                <span className="min-w-0 flex-1">
                  <span>{LABEL[p]}</span>
                  {p === 'sent' && sent?.signature && (
                    <span className="mt-0.5 block break-all font-mono text-xs text-slate-400">
                      <ExtLink href={explorerTx(sent.signature)}>{sent.signature}</ExtLink>
                    </span>
                  )}
                  {p === 'published' && project.token && (
                    <span className="mt-0.5 block break-all font-mono text-xs text-slate-400">
                      <ExtLink href={project.token.explorerUrl}>{project.token.address}</ExtLink>
                    </span>
                  )}
                  {p === 'signing' && st === 'active' && <span className="block text-xs text-slate-500">Approve the transaction in your wallet.</span>}
                  {p === 'verifying' && st === 'active' && <span className="block text-xs text-slate-500">The server reads the transaction and the token from the chain and checks supply, decimals and symbol.</span>}
                </span>
              </li>
            );
          })}
        </ol>
        {phase === 'preparing' && (
          <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
            <Spinner /> Preparing metadata…
          </div>
        )}
        {error && (
          <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-200">
            <div className="font-semibold">Something went wrong</div>
            <div className="mt-0.5 break-words text-xs">{error}</div>
            {verifyFailed && sent && <div className="mt-2 text-xs text-slate-300">The on-chain transaction may have succeeded. Retry the verification before creating a new token to avoid paying twice.</div>}
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-between gap-2">
        <button type="button" className="btn-ghost" onClick={onBack} disabled={running}>
          Back
        </button>
        <div className="flex flex-wrap gap-2">
          {verifyFailed && sent && sent.address && (
            <button className="btn-secondary" onClick={() => void submit(sent)}>
              Retry verification
            </button>
          )}
          {phase !== 'published' && (
            <button className="btn-primary" disabled={!canLaunch} onClick={() => void launch()}>
              {running ? <Spinner /> : <Rocket size={16} />} {phase === 'error' ? 'Try again with a new transaction' : sol ? 'Sign & create token' : 'Deploy contract'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
