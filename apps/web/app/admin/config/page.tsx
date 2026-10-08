'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Settings2 } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { can } from '@/components/admin/permissions';
import { fmtDate } from '@/components/ui/dates';
import { Empty, PageHeader, Spinner } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';

interface ConfigRow {
  key: string;
  value: unknown;
  updatedById: string | null;
  updatedAt: string;
}

function useSaveConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) => api<{ item: ConfigRow }>(`/admin/config/${encodeURIComponent(key)}`, { method: 'PUT', json: { value } }),
    onSuccess: (_d, v) => {
      toast.success('Config saved', v.key);
      void qc.invalidateQueries({ queryKey: ['admin', 'config'] });
    },
    onError: (e) => toast.error('Save failed', errorMessage(e)),
  });
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function ConfigEditor({ row, editable }: { row: ConfigRow; editable: boolean }) {
  const pretty = JSON.stringify(row.value, null, 2);
  const [text, setText] = useState(pretty);
  const [error, setError] = useState<string | null>(null);
  const save = useSaveConfig();
  const dirty = text !== pretty;
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-sm font-semibold text-ember-300">{row.key}</div>
        <div className="text-[11px] text-slate-500">Updated {fmtDate(row.updatedAt)}{row.updatedById ? ` by ${row.updatedById}` : ''}</div>
      </div>
      <textarea
        className={`input mt-3 min-h-[120px] font-mono text-xs ${error ? 'ring-2 ring-rose-500/50' : ''}`}
        value={text}
        readOnly={!editable}
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
      />
      {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
      {editable && (
        <div className="mt-2 flex justify-end gap-2">
          <button className="btn-ghost text-xs" disabled={!dirty} onClick={() => { setText(pretty); setError(null); }}>
            Reset
          </button>
          <button
            className="btn-primary text-xs"
            disabled={!dirty || save.isPending}
            onClick={() => {
              const parsed = parseJson(text);
              if (!parsed.ok) return setError(`Invalid JSON: ${parsed.error}`);
              if (window.confirm(`Overwrite config "${row.key}"? This affects the live game.`)) save.mutate({ key: row.key, value: parsed.value });
            }}
          >
            {save.isPending ? <Spinner /> : <Save size={14} />} Save
          </button>
        </div>
      )}
    </div>
  );
}

function NewConfigForm() {
  const [key, setKey] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = useSaveConfig();
  return (
    <form
      className="card space-y-2 border-dashed p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = parseJson(text);
        if (!parsed.ok) return setError(`Invalid JSON: ${parsed.error}`);
        if (!key.trim()) return setError('Key is required');
        save.mutate({ key: key.trim(), value: parsed.value }, { onSuccess: () => { setKey(''); setText(''); setError(null); } });
      }}
    >
      <div className="flex items-center gap-2 font-display text-sm font-semibold text-white"><Plus size={16} className="text-mint-400" /> New override</div>
      <input className="input font-mono" placeholder="config.key" value={key} onChange={(e) => setKey(e.target.value)} />
      <textarea className="input min-h-[80px] font-mono text-xs" placeholder='JSON value, e.g. {"enabled": true} or 42' value={text} spellCheck={false} onChange={(e) => { setText(e.target.value); setError(null); }} />
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex justify-end">
        <button type="submit" className="btn-secondary text-xs" disabled={save.isPending || !key.trim() || !text.trim()}>
          {save.isPending ? <Spinner /> : <Save size={14} />} Create
        </button>
      </div>
    </form>
  );
}

export default function AdminConfigPage() {
  const me = useAuth((s) => s.user);
  const editable = can(me?.role, 'editConfig');
  const q = useQuery({ queryKey: ['admin', 'config'], queryFn: () => api<{ items: ConfigRow[] }>('/admin/config') });
  return (
    <div>
      <PageHeader title="Game config" subtitle={editable ? 'Runtime overrides stored as JSON. Changes are audited.' : 'Read-only for your role. Admins and developers can edit overrides.'} />
      {q.isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Spinner /> Loading config…</div>
      ) : q.error ? (
        <Empty title="Could not load config" body={errorMessage(q.error)} action={<button className="btn-secondary" onClick={() => void q.refetch()}>Retry</button>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {q.data?.items.length === 0 && (
            <div className="card flex items-center gap-3 p-6 text-sm text-slate-400 lg:col-span-2">
              <Settings2 size={18} className="text-slate-500" /> No overrides set. The game runs on its built-in defaults.
            </div>
          )}
          {q.data?.items.map((row) => (
            <ConfigEditor key={`${row.key}:${row.updatedAt}`} row={row} editable={editable} />
          ))}
          {editable && <NewConfigForm />}
        </div>
      )}
    </div>
  );
}
