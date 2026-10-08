'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import type { ClanMessageDTO } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { useSocket } from '@/lib/socket';
import { Spinner } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';

const MAX_LEN = 500;

export function ClanChat({ clanId, initial, myPlayerId }: { clanId: string; initial: ClanMessageDTO[]; myPlayerId: string }) {
  const { status, send, subscribe } = useSocket();
  const [messages, setMessages] = useState<ClanMessageDTO[]>(initial);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const live = status === 'authed';

  // Fresh history from the server (e.g. after a refetch) replaces what we have, keeping live messages that arrived since.
  useEffect(() => {
    setMessages((prev) => {
      const seen = new Set(initial.map((m) => m.id));
      return [...initial, ...prev.filter((m) => !seen.has(m.id) && new Date(m.createdAt).getTime() > (initial.at(-1) ? new Date(initial.at(-1)!.createdAt).getTime() : 0))];
    });
  }, [initial]);

  // Tell the game server which clan we belong to so it forwards chat, and listen for messages.
  useEffect(() => {
    if (live) send({ type: 'clan:subscribe' });
    return subscribe((msg) => {
      if (msg.type !== 'clan:message' || msg.message.clanId !== clanId) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.message.id) ? prev : [...prev, msg.message].slice(-200)));
    });
  }, [live, clanId, send, subscribe]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const content = text.trim().slice(0, MAX_LEN);
    if (!content || sending) return;
    setSending(true);
    try {
      if (!send({ type: 'clan:message', content })) {
        // Socket closed: post over HTTP; the server still fans it out to online clanmates.
        const { message } = await api<{ message: ClanMessageDTO }>('/game/clans/messages', { method: 'POST', json: { content } });
        setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      }
      setText('');
    } catch (e) {
      toast.error('Message not sent', errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card flex h-[520px] flex-col p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-display text-sm font-semibold text-white">
          <MessageSquare size={16} className="text-elixir-400" /> Clan chat
        </div>
        <span className={`badge gap-1 ${live ? 'border-mint-500/30 text-mint-400' : 'text-slate-400'}`}>
          <i className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-mint-400' : 'bg-slate-500'}`} /> {live ? 'live' : 'offline mode'}
        </span>
      </div>
      <div ref={listRef} className="scroll-thin mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
        {messages.length === 0 && <p className="py-8 text-center text-xs text-slate-500">No messages yet. Say hello to your clan.</p>}
        {messages.map((m) => {
          const own = m.playerId === myPlayerId;
          return (
            <div key={m.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${own ? 'rounded-br-sm bg-ember-500/20 text-slate-100' : 'rounded-bl-sm bg-white/[0.05] text-slate-200'}`}>
                {!own && <div className="text-[11px] font-semibold text-ember-300">{m.playerName}</div>}
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
                <div className="mt-0.5 text-right text-[10px] text-slate-500">{new Date(m.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={(e) => void submit(e)} className="mt-3 flex gap-2">
        <input className="input" placeholder="Message your clan…" value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_LEN} />
        <button type="submit" className="btn-primary shrink-0 px-3" disabled={!text.trim() || sending} aria-label="Send">
          {sending ? <Spinner /> : <Send size={16} />}
        </button>
      </form>
    </div>
  );
}
