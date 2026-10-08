'use client';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HandHelping, Megaphone } from 'lucide-react';
import { TROOP_DEFINITIONS } from '@launch/game-engine';
import type { ArmyDTO } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import type { ClanTroopRequest } from './types';
import { TroopAvatar, troopName } from '@/components/army/troop-avatar';
import { ago } from '@/components/ui/dates';
import { ProgressBar } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';

function DonateForm({ request, army, onDone }: { request: ClanTroopRequest; army: ArmyDTO; onDone: () => void }) {
  const options = army.units.filter((u) => u.count > 0);
  const [troopType, setTroopType] = useState(options[0]?.troopType ?? '');
  const [count, setCount] = useState(1);
  const unit = options.find((u) => u.troopType === troopType);
  const housing = TROOP_DEFINITIONS[troopType]?.housing ?? 1;
  const room = Math.floor((request.capacity - request.filled) / housing);
  const max = Math.max(0, Math.min(50, unit?.count ?? 0, room));
  const donate = useMutation({
    mutationFn: () => api<{ ok: true }>(`/game/clans/requests/${request.id}/donate`, { method: 'POST', json: { troopType, count } }),
    onSuccess: () => {
      toast.success('Troops sent', `${count}× ${troopName(troopType)} delivered to ${request.playerName}.`);
      onDone();
    },
    onError: (e) => toast.error('Donation failed', errorMessage(e)),
  });
  if (options.length === 0) return <p className="mt-2 text-xs text-slate-500">You have no trained troops to donate.</p>;
  const reason = max <= 0 ? (room <= 0 ? 'No room left in the request' : 'None of that troop available') : count > max ? `Max ${max}` : null;
  return (
    <form
      className="mt-2 flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!reason) donate.mutate();
      }}
    >
      <div>
        <label className="label">Troop</label>
        <select
          className="input w-auto py-1.5 text-xs"
          value={troopType}
          onChange={(e) => {
            setTroopType(e.target.value);
            setCount(1);
          }}
        >
          {options.map((u) => (
            <option key={u.troopType} value={u.troopType}>
              {troopName(u.troopType)} (×{u.count}, lvl {u.level})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Count</label>
        <input className="input w-20 py-1.5 font-mono text-xs" type="number" min={1} max={Math.max(1, max)} value={count} onChange={(e) => setCount(Math.max(1, Math.floor(Number(e.target.value) || 1)))} />
      </div>
      <button type="submit" className="btn-primary px-3 py-1.5 text-xs" disabled={!!reason || donate.isPending} title={reason ?? undefined}>
        {donate.isPending ? <Spinner /> : <HandHelping size={14} />}
        {reason ?? `Donate ${count * housing} housing`}
      </button>
    </form>
  );
}

export function TroopRequests({ requests, myPlayerId }: { requests: ClanTroopRequest[]; myPlayerId: string }) {
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [openDonate, setOpenDonate] = useState<string | null>(null);
  const army = useQuery({ queryKey: ['army'], queryFn: () => api<{ army: ArmyDTO }>('/game/army'), enabled: openDonate !== null });
  const mine = useMemo(() => requests.find((r) => r.playerId === myPlayerId), [requests, myPlayerId]);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['clan'] });
    void qc.invalidateQueries({ queryKey: ['army'] });
  };
  const request = useMutation({
    mutationFn: () => api<{ request: unknown }>('/game/clans/requests', { method: 'POST', json: { message: message.trim() } }),
    onSuccess: () => {
      toast.success('Reinforcements requested');
      setMessage('');
      refresh();
    },
    onError: (e) => toast.error('Could not request troops', errorMessage(e)),
  });

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-display text-sm font-semibold text-white">
          <Megaphone size={16} className="text-ember-400" /> Reinforcements
        </div>
        <span className="badge">{requests.length} open</span>
      </div>
      {mine ? (
        <p className="mt-2 text-xs text-slate-400">
          Your request is open: <span className="font-mono text-slate-200">{mine.filled}/{mine.capacity}</span> housing filled.
        </p>
      ) : (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            request.mutate();
          }}
        >
          <input className="input" placeholder="Ask your clan for troops (optional note)" maxLength={140} value={message} onChange={(e) => setMessage(e.target.value)} />
          <button type="submit" className="btn-primary shrink-0" disabled={request.isPending}>
            {request.isPending ? <Spinner /> : <Megaphone size={16} />} Request
          </button>
        </form>
      )}
      <ul className="mt-3 space-y-2">
        {requests.length === 0 && <li className="text-xs text-slate-500">No open requests. Ask for reinforcements before your next raid.</li>}
        {requests.map((r) => {
          const isMine = r.playerId === myPlayerId;
          const open = openDonate === r.id;
          return (
            <li key={r.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-100">{r.playerName}</span>
                {isMine && <span className="badge">you</span>}
                <span className="text-[11px] text-slate-500">{ago(r.createdAt)}</span>
                <span className="ml-auto font-mono text-xs text-slate-300">
                  {r.filled}/{r.capacity}
                </span>
              </div>
              {r.message && <p className="mt-1 text-xs text-slate-400">“{r.message}”</p>}
              <ProgressBar value={r.filled} max={r.capacity} color="mint" size="sm" className="mt-2" />
              {!isMine && (
                <>
                  <button className="btn-secondary mt-2 px-3 py-1 text-xs" onClick={() => setOpenDonate(open ? null : r.id)}>
                    <HandHelping size={14} /> {open ? 'Close' : 'Donate'}
                  </button>
                  {open &&
                    (army.data ? (
                      <DonateForm
                        request={r}
                        army={army.data.army}
                        onDone={() => {
                          setOpenDonate(null);
                          refresh();
                        }}
                      />
                    ) : army.error ? (
                      <p className="mt-2 text-xs text-rose-300">{errorMessage(army.error)}</p>
                    ) : (
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                        <Spinner /> Loading your army…
                      </div>
                    ))}
                </>
              )}
              {isMine && r.filled > 0 && (
                <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
                  <TroopAvatar type="grunt" size="sm" className="hidden" />
                  Donated troops join your army automatically.
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
