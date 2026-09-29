"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { ArrowUpRight, ChartColumn, Compass, FileText, House, LoaderCircle, Rocket, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { chains, pads } from "@/lib/pads";
import type { PublicLaunch } from "@/lib/types";
import { PadGlyph, TokenAvatar } from "@/components/ui/PadGlyph";

const pages = [
  { href: "/", label: "Home", icon: House },
  { href: "/explore", label: "Explore launches", icon: Compass },
  { href: "/launch", label: "Open the launch studio", icon: Rocket },
  { href: "/analytics", label: "Analytics", icon: ChartColumn },
  { href: "/docs", label: "Docs", icon: FileText },
];

const groupCls =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.18em] [&_[cmdk-group-heading]]:text-mute";

const itemCls =
  "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-fog data-[selected=true]:bg-surface-3 data-[selected=true]:text-bone";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicLaunch[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Debounced ledger search.
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) {
      setResults([]);
      setState("idle");
      return;
    }
    setState("loading");
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/launches?limit=8&q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: { launches: PublicLaunch[] }) => {
          setResults(d.launches);
          setState("idle");
        })
        .catch((e) => e?.name !== "AbortError" && setState("error"));
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, open]);

  const needle = query.trim().toLowerCase();
  const pageHits = pages.filter((p) => p.label.toLowerCase().includes(needle));
  const padHits = pads.filter((p) => `${p.name} ${chains.find((c) => c.id === p.chain)?.name}`.toLowerCase().includes(needle));

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[12vh] z-[81] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-2xl shadow-black/60"
        >
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <Command shouldFilter={false} label="Search tokens, creators and pages" loop>
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-4 text-mute" aria-hidden="true" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Search tokens, tickers, creators or pages"
                className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-mute"
              />
              {state === "loading" && <LoaderCircle className="size-4 animate-spin text-mute" aria-label="Searching" />}
              <kbd className="rounded-md border border-line-strong px-1.5 py-0.5 font-mono text-[10px] text-mute">ESC</kbd>
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              {state === "error" && <p className="px-3 py-6 text-center text-sm text-danger">Search is unavailable right now.</p>}

              {needle.length >= 2 && state === "idle" && results.length === 0 && pageHits.length === 0 && padHits.length === 0 && (
                <Command.Empty className="px-3 py-6 text-center text-sm text-mute">
                  No launches match “{query.trim()}”.
                </Command.Empty>
              )}

              {results.length > 0 && (
                <Command.Group heading="Launches" className={groupCls}>
                  {results.map((l) => (
                    <Command.Item key={l.id} value={l.id} onSelect={() => go(`/explore?q=${encodeURIComponent(l.ticker)}`)} className={itemCls}>
                      <TokenAvatar image={l.image} ticker={l.ticker} className="size-7 rounded-lg text-[10px]" />
                      <span className="flex-1 truncate text-bone">{l.name}</span>
                      <span className="font-mono text-xs text-mute">${l.ticker}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {pageHits.length > 0 && (
              <Command.Group heading="Pages" className={groupCls}>
                {pageHits.map((p) => (
                    <Command.Item key={p.href} value={p.href} onSelect={() => go(p.href)} className={itemCls}>
                      <p.icon className="size-4" aria-hidden="true" />
                      <span className="flex-1">{p.label}</span>
                      <ArrowUpRight className="size-3.5 text-mute" aria-hidden="true" />
                    </Command.Item>
                  ))}
              </Command.Group>
              )}

              {padHits.length > 0 && (
              <Command.Group heading="Launch on" className={groupCls}>
                {padHits.map((p) => (
                    <Command.Item
                      key={p.id}
                      value={`pad-${p.id}`}
                      onSelect={() => go(`/launch?chain=${p.chain}&pad=${p.id}`)}
                      className={itemCls}
                    >
                      <PadGlyph pad={p.id} size="sm" />
                      <span className="flex-1 text-bone">{p.name}</span>
                      <span className="text-xs text-mute">{chains.find((c) => c.id === p.chain)?.name}</span>
                    </Command.Item>
                  ))}
              </Command.Group>
              )}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
