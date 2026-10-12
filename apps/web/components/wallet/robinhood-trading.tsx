'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw, ShoppingCart, XCircle } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { tGlobal, useT } from '@/lib/i18n';
import { toast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/primitives';
import { Field, SectionTitle } from '@/components/launchpad/common';
import type { RhAccount, RhHolding, RhOrder, RhQuote } from './robinhood-types';

const QUOTE_SYMBOLS = ['BTC-USD', 'ETH-USD', 'SOL-USD'];

function usd(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return tGlobal('Data unavailable');
  return Number(v).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

export function RobinhoodAccountPanel() {
  const t = useT();
  const account = useQuery({ queryKey: ['robinhood', 'account'], queryFn: () => api<{ account: RhAccount }>('/robinhood/account') });
  const holdings = useQuery({ queryKey: ['robinhood', 'holdings'], queryFn: () => api<{ holdings: RhHolding[] }>('/robinhood/holdings') });
  return (
    <div className="card p-4">
      <SectionTitle>{t('Account & holdings')}</SectionTitle>
      {account.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Spinner /> {t('Loading account…')}
        </div>
      ) : account.isError ? (
        <div className="text-sm text-rose-300">{errorMessage(account.error)}</div>
      ) : account.data ? (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">{t('Buying power')}</div>
            <div className="font-display text-2xl font-bold text-white">
              {Number(account.data.account.buying_power).toLocaleString(undefined, { style: 'currency', currency: account.data.account.buying_power_currency || 'USD' })}
            </div>
          </div>
          <div className="text-xs text-slate-500">
            {t('Account {number}', { number: account.data.account.account_number })} · {account.data.account.status}
          </div>
        </div>
      ) : null}
      <div className="mt-4 text-[11px] uppercase tracking-wide text-slate-500">{t('Holdings')}</div>
      {holdings.isLoading ? (
        <Spinner className="mt-2" />
      ) : holdings.isError ? (
        <div className="text-sm text-rose-300">{errorMessage(holdings.error)}</div>
      ) : holdings.data?.holdings.length === 0 ? (
        <div className="py-2 text-sm text-slate-500">{t('No crypto holdings.')}</div>
      ) : (
        <table className="mt-1 w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-1">{t('Asset')}</th>
              <th className="py-1 text-right">{t('Total')}</th>
              <th className="py-1 text-right">{t('Available')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {holdings.data?.holdings.map((h) => (
              <tr key={h.asset_code}>
                <td className="py-2 font-semibold text-white">{h.asset_code}</td>
                <td className="py-2 text-right font-mono">{h.total_quantity}</td>
                <td className="py-2 text-right font-mono text-slate-400">{h.quantity_available_for_trading}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function RobinhoodQuotes() {
  const t = useT();
  const q = useQuery({ queryKey: ['robinhood', 'quotes', QUOTE_SYMBOLS], queryFn: () => api<{ quotes: RhQuote[] }>(`/robinhood/quotes?symbols=${QUOTE_SYMBOLS.join(',')}`), refetchInterval: 15_000 });
  return (
    <div className="card p-4">
      <SectionTitle
        actions={
          <button className="btn-ghost p-1.5" onClick={() => void q.refetch()} title={t('Refresh')}>
            <RefreshCw size={14} className={q.isFetching ? 'animate-spin' : ''} />
          </button>
        }
      >
        {t('Live quotes')}
      </SectionTitle>
      {q.isLoading ? (
        <Spinner />
      ) : q.isError ? (
        <div className="text-sm text-rose-300">{errorMessage(q.error)}</div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          {QUOTE_SYMBOLS.map((s) => {
            const quote = q.data?.quotes.find((x) => x.symbol === s);
            return (
              <div key={s} className="stat">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">{s}</div>
                <div className="mt-1 font-display text-lg font-bold text-white">{usd(quote?.price)}</div>
                <div className="text-[11px] text-slate-500">
                  {t('bid {bid} · ask {ask}', { bid: usd(quote?.bid_inclusive_of_sell_spread), ask: usd(quote?.ask_inclusive_of_buy_spread) })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {q.data && <div className="mt-2 text-[11px] text-slate-600">{t('Best bid/ask from Robinhood, inclusive of spread. Auto-refreshes every 15s.')}</div>}
    </div>
  );
}

export function RobinhoodOrders() {
  const t = useT();
  const qc = useQueryClient();
  const [symbol, setSymbol] = useState('BTC-USD');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [qty, setQty] = useState('');
  const [confirming, setConfirming] = useState(false);
  const orders = useQuery({ queryKey: ['robinhood', 'orders'], queryFn: () => api<{ orders: RhOrder[] }>('/robinhood/orders') });

  const place = useMutation({
    mutationFn: () => api<{ order: RhOrder }>('/robinhood/orders', { method: 'POST', json: { symbol: symbol.toUpperCase(), side, type: 'market', assetQuantity: qty, clientOrderId: crypto.randomUUID() } }),
    onSuccess: (r) => {
      setConfirming(false);
      setQty('');
      toast.success(t('Order placed'), `${r.order.side} ${r.order.symbol} · ${r.order.state}`);
      void qc.invalidateQueries({ queryKey: ['robinhood'] });
      void qc.invalidateQueries({ queryKey: ['portfolio'] });
    },
    onError: (e) => {
      setConfirming(false);
      toast.error(t('Order rejected'), errorMessage(e));
    },
  });
  const cancel = useMutation({
    mutationFn: (id: string) => api(`/robinhood/orders/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      toast.success(t('Cancel requested'));
      void qc.invalidateQueries({ queryKey: ['robinhood', 'orders'] });
    },
    onError: (e) => toast.error(t('Could not cancel'), errorMessage(e)),
  });

  const validSymbol = /^[A-Z0-9]{2,10}-USD$/.test(symbol.toUpperCase());
  const validQty = /^\d+(\.\d+)?$/.test(qty) && Number(qty) > 0;
  const cancellable = (o: RhOrder) => ['open', 'queued', 'pending', 'partially_filled', 'in_progress'].includes(o.state.toLowerCase());

  return (
    <div className="card p-4">
      <SectionTitle>{t('Market order')}</SectionTitle>
      <div className="mb-3 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-100">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-300" />
        <span>{t('This places a real order with real money on your Robinhood account. Market orders fill immediately at the current price and cannot be undone.')}</span>
      </div>
      <form
        className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          if (validSymbol && validQty) setConfirming(true);
        }}
      >
        <Field label={t('Symbol')} error={symbol && !validSymbol ? t('Format: BTC-USD') : undefined}>
          <input className="input font-mono uppercase" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="BTC-USD" />
        </Field>
        <Field label={t('Side')}>
          <select className="input" value={side} onChange={(e) => setSide(e.target.value as 'buy' | 'sell')}>
            <option value="buy">{t('Buy')}</option>
            <option value="sell">{t('Sell')}</option>
          </select>
        </Field>
        <Field label={t('Asset quantity')} hint={t('In units of the asset (e.g. 0.001 BTC)')}>
          <input className="input font-mono" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.001" />
        </Field>
        <div className="flex items-end">
          <button className="btn-primary w-full" type="submit" disabled={!validSymbol || !validQty || place.isPending}>
            <ShoppingCart size={16} /> {t('Review order')}
          </button>
        </div>
      </form>

      {confirming && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4" onClick={() => !place.isPending && setConfirming(false)}>
          <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-semibold text-white">{t('Confirm real order')}</h3>
            <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('Side')}</span>
                <span className={side === 'buy' ? 'font-semibold text-mint-400' : 'font-semibold text-rose-300'}>{t(side.toUpperCase())}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('Symbol')}</span>
                <span className="font-mono text-white">{symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('Quantity')}</span>
                <span className="font-mono text-white">{qty}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('Type')}</span>
                <span className="text-white">{t('Market')}</span>
              </div>
            </div>
            <p className="mt-3 flex items-start gap-2 text-sm text-rose-200">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {t('This places a real order with real money on your Robinhood account. It executes immediately at the market price.')}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setConfirming(false)} disabled={place.isPending}>
                {t('Cancel')}
              </button>
              <button className="btn-danger" onClick={() => place.mutate()} disabled={place.isPending}>
                {place.isPending && <Spinner />} {side === 'buy' ? t('Place buy order') : t('Place sell order')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6">
        <SectionTitle
          actions={
            <button className="btn-ghost p-1.5" onClick={() => void orders.refetch()} title={t('Refresh')}>
              <RefreshCw size={14} className={orders.isFetching ? 'animate-spin' : ''} />
            </button>
          }
        >
          {t('Orders')}
        </SectionTitle>
        {orders.isLoading ? (
          <Spinner />
        ) : orders.isError ? (
          <div className="text-sm text-rose-300">{errorMessage(orders.error)}</div>
        ) : orders.data?.orders.length === 0 ? (
          <div className="text-sm text-slate-500">{t('No orders yet.')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-1 pr-3">{t('Symbol')}</th>
                  <th className="py-1 pr-3">{t('Side')}</th>
                  <th className="py-1 pr-3">{t('Type')}</th>
                  <th className="py-1 pr-3">{t('State')}</th>
                  <th className="py-1 pr-3 text-right">{t('Filled')}</th>
                  <th className="py-1 pr-3 text-right">{t('Avg price')}</th>
                  <th className="py-1 pr-3">{t('Created')}</th>
                  <th className="py-1" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {orders.data?.orders.map((o) => (
                  <tr key={o.id}>
                    <td className="py-2 pr-3 font-mono text-white">{o.symbol}</td>
                    <td className={`py-2 pr-3 ${o.side === 'buy' ? 'text-mint-400' : 'text-rose-300'}`}>{o.side}</td>
                    <td className="py-2 pr-3 text-slate-400">{o.type}</td>
                    <td className="py-2 pr-3">
                      <span className="badge">{o.state}</span>
                    </td>
                    <td className="py-2 pr-3 text-right font-mono">{o.filled_asset_quantity}</td>
                    <td className="py-2 pr-3 text-right font-mono">{usd(o.average_price)}</td>
                    <td className="py-2 pr-3 text-xs text-slate-400">{new Date(o.created_at).toLocaleString()}</td>
                    <td className="py-2 text-right">
                      {cancellable(o) && (
                        <button className="btn-ghost p-1.5 text-slate-400 hover:text-rose-300" title={t('Cancel order')} disabled={cancel.isPending} onClick={() => confirm(t('Cancel order {id}?', { id: o.id })) && cancel.mutate(o.id)}>
                          <XCircle size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
