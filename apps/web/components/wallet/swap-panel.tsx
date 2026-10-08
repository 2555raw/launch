'use client';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import { ArrowDownUp, Info } from 'lucide-react';
import { solanaExplorerTxUrl } from '@launch/config/chains';
import { api, errorMessage } from '@/lib/api';
import { SOLANA_NETWORK } from '@/lib/config';
import { useAuth } from '@/lib/auth-store';
import { toast } from '@/components/ui/toast';
import { Spinner, shortAddr } from '@/components/ui/primitives';
import { ExtLink, Field, formatUnits } from '@/components/launchpad/common';
import { base64ToBytes, bytesToBase64, toSmallestUnits, walletErrorMessage } from './encoding';
import { useLinkWallet } from './use-link-wallet';

interface SwapConfig {
  provider: string;
  apiUrl: string;
  network: string;
  executable: boolean;
  wellKnownMints: Record<string, string>;
  keyless: boolean;
}
interface JupiterOrder {
  requestId: string;
  transaction: string | null;
  inAmount: string;
  outAmount: string;
  inputMint: string;
  outputMint: string;
  slippageBps?: number;
  priceImpactPct?: string;
  router?: string;
  errorCode?: number;
  errorMessage?: string;
}
interface JupiterExecute {
  status: 'Success' | 'Failed';
  signature?: string;
  code: number;
  error?: string;
  totalInputAmount?: string;
  totalOutputAmount?: string;
}

const KNOWN_DECIMALS: Record<string, number> = { SOL: 9, USDC: 6, USDT: 6 };
type MintChoice = 'SOL' | 'USDC' | 'USDT' | 'CUSTOM';

function useMintDecimals(mint: string | null) {
  const { connection } = useConnection();
  return useQuery({
    queryKey: ['mint-decimals', mint],
    queryFn: async () => {
      const info = await connection.getParsedAccountInfo(new PublicKey(mint as string));
      const data = info.value?.data;
      if (!data || !('parsed' in data)) throw new Error('Not a token mint');
      const decimals = (data.parsed as { info?: { decimals?: number } }).info?.decimals;
      if (typeof decimals !== 'number') throw new Error('Mint has no decimals field');
      return decimals;
    },
    enabled: !!mint && mint.length >= 32,
    staleTime: Infinity,
    retry: false,
  });
}

function MintSelect({ label, choice, custom, onChoice, onCustom, wellKnown }: { label: string; choice: MintChoice; custom: string; onChoice: (c: MintChoice) => void; onCustom: (v: string) => void; wellKnown: Record<string, string> }) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <select className="input w-32 shrink-0" value={choice} onChange={(e) => onChoice(e.target.value as MintChoice)}>
          {Object.keys(wellKnown).map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
          <option value="CUSTOM">Custom…</option>
        </select>
        {choice === 'CUSTOM' && <input className="input font-mono text-xs" value={custom} onChange={(e) => onCustom(e.target.value.trim())} placeholder="Mint address" />}
      </div>
    </Field>
  );
}

export function SwapPanel({ preselectOutput }: { preselectOutput?: string | null }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { user } = useAuth();
  const { isLinked } = useLinkWallet();
  const taker = wallet.publicKey?.toBase58() ?? null;

  const config = useQuery({ queryKey: ['swap', 'config'], queryFn: () => api<SwapConfig>('/swap/config') });
  const wellKnown = useMemo(() => config.data?.wellKnownMints ?? { SOL: 'So11111111111111111111111111111111111111112', USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' }, [config.data]);

  const [inChoice, setInChoice] = useState<MintChoice>('SOL');
  const [inCustom, setInCustom] = useState('');
  const [outChoice, setOutChoice] = useState<MintChoice>('USDC');
  const [outCustom, setOutCustom] = useState('');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState('50');
  const [result, setResult] = useState<JupiterExecute | null>(null);
  const [stage, setStage] = useState<'idle' | 'signing' | 'executing'>('idle');

  useEffect(() => {
    if (!preselectOutput) return;
    const known = Object.entries(wellKnown).find(([, v]) => v === preselectOutput);
    if (known) setOutChoice(known[0] as MintChoice);
    else {
      setOutChoice('CUSTOM');
      setOutCustom(preselectOutput);
    }
  }, [preselectOutput, wellKnown]);

  const inputMint = inChoice === 'CUSTOM' ? inCustom : wellKnown[inChoice] ?? '';
  const outputMint = outChoice === 'CUSTOM' ? outCustom : wellKnown[outChoice] ?? '';
  const inDecimalsQ = useMintDecimals(inChoice === 'CUSTOM' ? inputMint : null);
  const outDecimalsQ = useMintDecimals(outChoice === 'CUSTOM' ? outputMint : null);
  const inDecimals = inChoice === 'CUSTOM' ? inDecimalsQ.data ?? null : KNOWN_DECIMALS[inChoice];
  const outDecimals = outChoice === 'CUSTOM' ? outDecimalsQ.data ?? null : KNOWN_DECIMALS[outChoice];
  const rawAmount = inDecimals !== null ? toSmallestUnits(amount, inDecimals) : null;
  const slippageBps = Math.min(5000, Math.max(1, Number(slippage) || 50));
  const canQuote = !!user && !!inputMint && !!outputMint && inputMint !== outputMint && !!rawAmount;

  const quote = useQuery({
    queryKey: ['swap', 'quote', inputMint, outputMint, rawAmount, taker, slippageBps],
    queryFn: () => {
      const qs = new URLSearchParams({ inputMint, outputMint, amount: rawAmount as string, slippageBps: String(slippageBps) });
      if (taker) qs.set('taker', taker);
      return api<{ order: JupiterOrder }>(`/swap/quote?${qs}`);
    },
    enabled: canQuote,
    refetchInterval: 15_000,
    retry: false,
  });
  const order = quote.data?.order ?? null;

  const execute = useMutation({
    mutationFn: async () => {
      if (!order?.transaction) throw new Error('No transaction in the quote. Connect a wallet so Jupiter can build one.');
      if (!wallet.signTransaction || !taker) throw new Error('Connect a Solana wallet that can sign transactions');
      setStage('signing');
      const tx = VersionedTransaction.deserialize(base64ToBytes(order.transaction));
      const signed = await wallet.signTransaction(tx);
      setStage('executing');
      const res = await api<{ result: JupiterExecute }>('/swap/execute', { method: 'POST', json: { signedTransaction: bytesToBase64(signed.serialize()), requestId: order.requestId, inputMint, outputMint, taker } });
      return res.result;
    },
    onSuccess: (r) => {
      setResult(r);
      if (r.status === 'Success') toast.success('Swap executed', r.signature ? shortAddr(r.signature, 8) : undefined);
      else toast.error('Swap failed', r.error ?? `Jupiter code ${r.code}`);
    },
    onError: (e) => toast.error('Swap failed', walletErrorMessage(e) || errorMessage(e)),
    onSettled: () => setStage('idle'),
  });

  const flip = () => {
    const ic = inChoice;
    const icu = inCustom;
    setInChoice(outChoice);
    setInCustom(outCustom);
    setOutChoice(ic);
    setOutCustom(icu);
  };

  const executable = config.data?.executable ?? false;
  const linked = isLinked('SOLANA', taker);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-white">Swap</h2>
        <span className="badge">Jupiter v2 {config.data?.keyless ? '· keyless' : ''}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">Quotes and execution are routed through Jupiter&apos;s aggregator via our API; the transaction is signed by your wallet, never by the server.</p>

      {config.isError && <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-200">Swap configuration unavailable: {errorMessage(config.error)}</div>}
      {config.data && !executable && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-gold-500/30 bg-gold-500/5 p-3 text-sm text-slate-200">
          <Info size={16} className="mt-0.5 shrink-0 text-gold-400" />
          <span>Jupiter aggregates Solana mainnet liquidity. Quotes are live mainnet data; execution is disabled while this server runs on {config.data.network}.</span>
        </div>
      )}
      {!user && <div className="mt-3 text-sm text-slate-400">Sign in to request quotes.</div>}

      <div className="mt-4 grid gap-3">
        <MintSelect label="You pay" choice={inChoice} custom={inCustom} onChoice={setInChoice} onCustom={setInCustom} wellKnown={wellKnown} />
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="Amount" hint={inChoice === 'CUSTOM' ? (inDecimalsQ.isLoading ? 'Reading mint decimals…' : inDecimalsQ.isError ? `Cannot read mint: ${inDecimalsQ.error.message}` : inDecimals !== null ? `${inDecimals} decimals` : undefined) : undefined}>
            <input className="input font-mono" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.0" />
          </Field>
          <Field label="Slippage (bps)">
            <input className="input w-28 font-mono" inputMode="numeric" value={slippage} onChange={(e) => setSlippage(e.target.value.replace(/\D/g, ''))} />
          </Field>
        </div>
        <div className="flex justify-center">
          <button type="button" className="btn-ghost p-2" onClick={flip} title="Flip">
            <ArrowDownUp size={16} />
          </button>
        </div>
        <MintSelect label="You receive" choice={outChoice} custom={outCustom} onChoice={setOutChoice} onCustom={setOutCustom} wellKnown={wellKnown} />
        {outChoice === 'CUSTOM' && outDecimalsQ.isError && <div className="text-xs text-rose-300">Cannot read output mint: {outDecimalsQ.error.message}</div>}
      </div>

      <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-sm">
        {!canQuote ? (
          <div className="text-slate-500">Enter an amount to get a live quote.</div>
        ) : quote.isLoading ? (
          <div className="flex items-center gap-2 text-slate-400">
            <Spinner /> Fetching quote…
          </div>
        ) : quote.isError ? (
          <div className="text-rose-300">{errorMessage(quote.error)}</div>
        ) : order ? (
          <div className="grid gap-1">
            <div className="flex justify-between">
              <span className="text-slate-500">You receive</span>
              <span className="font-display font-semibold text-white">
                {outDecimals !== null ? formatUnits(order.outAmount, outDecimals, 6) : order.outAmount} {outChoice === 'CUSTOM' ? shortAddr(outputMint, 4) : outChoice}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Price impact</span>
              <span className="text-slate-200">{order.priceImpactPct !== undefined ? `${Number(order.priceImpactPct).toFixed(3)}%` : 'Data unavailable'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Router</span>
              <span className="text-slate-200">{order.router ?? 'Data unavailable'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Request id</span>
              <span className="font-mono text-slate-400">{shortAddr(order.requestId, 6)}</span>
            </div>
            {order.errorMessage && <div className="text-xs text-rose-300">{order.errorMessage}</div>}
            {!order.transaction && <div className="text-xs text-gold-300">Quote only: connect a Solana wallet to receive a signable transaction.</div>}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={!executable || !order?.transaction || !taker || !linked || execute.isPending} onClick={() => execute.mutate()}>
          {execute.isPending ? <Spinner /> : <ArrowDownUp size={16} />} {stage === 'signing' ? 'Sign in wallet…' : stage === 'executing' ? 'Executing…' : 'Swap'}
        </button>
        {taker && !linked && user && <span className="text-xs text-gold-300">Link the connected wallet to your account to execute swaps.</span>}
        {!taker && user && <span className="text-xs text-slate-500">Connect a Solana wallet to execute.</span>}
      </div>

      {result && (
        <div className={`mt-4 rounded-xl border p-3 text-sm ${result.status === 'Success' ? 'border-mint-500/30 bg-mint-500/5' : 'border-rose-500/30 bg-rose-500/5'}`}>
          <div className="font-semibold text-white">{result.status === 'Success' ? 'Swap confirmed' : 'Swap failed'}</div>
          {result.signature && (
            <div className="mt-1 break-all font-mono text-xs">
              <ExtLink href={solanaExplorerTxUrl(result.signature, SOLANA_NETWORK)}>{result.signature}</ExtLink>
            </div>
          )}
          {result.totalOutputAmount && outDecimals !== null && <div className="mt-1 text-xs text-slate-300">Received {formatUnits(result.totalOutputAmount, outDecimals, 6)}</div>}
          {result.error && <div className="mt-1 text-xs text-rose-300">{result.error}</div>}
        </div>
      )}
    </div>
  );
}
