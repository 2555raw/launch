"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Bot, Check, Copy, KeyRound, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { site } from "@/lib/site";
import type { PublicAgent } from "@/lib/types";
import { useCopy } from "@/components/ui/useCopy";
import { useApp } from "./AppProvider";

type Step = { kind: "form" } | { kind: "key"; key: string; agent: PublicAgent } | { kind: "connected" };

export function ConnectAgentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { agent, setAgent, toast } = useApp();
  const [step, setStep] = useState<Step>({ kind: "form" });
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const { copied, copy } = useCopy();

  useEffect(() => {
    if (open) {
      setStep(agent ? { kind: "connected" } : { kind: "form" });
      setError(null);
      setSaved(false);
    }
    // Only reset when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const locked = step.kind === "key" && !saved;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) return setError("Give your agent a name of at least 2 characters.");
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.fields?.name ?? data.error ?? "Could not create the key.");
      setStep({ kind: "key", key: data.key, agent: data.agent });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  function finish() {
    if (step.kind !== "key") return;
    setAgent(step.agent);
    onOpenChange(false);
    toast({ kind: "success", title: `${step.agent.name} is connected`, body: "Hand it the key and it can submit launches." });
  }

  const mcpConfig = (key: string) =>
    JSON.stringify(
      {
        mcpServers: {
          [site.name.toLowerCase()]: {
            url: `${typeof window !== "undefined" ? window.location.origin : site.url}/api/mcp`,
            headers: { Authorization: `Bearer ${key}` },
          },
        },
      },
      null,
      2,
    );

  return (
    <Dialog.Root open={open} onOpenChange={(o) => (!o && locked ? undefined : onOpenChange(o))}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[81] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-line-strong bg-surface p-6 shadow-2xl shadow-black/60 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <span className="grid size-11 place-items-center rounded-2xl bg-ember/10 text-ember">
              {step.kind === "key" ? <KeyRound className="size-5" /> : <Bot className="size-5" />}
            </span>
            {!locked && (
              <Dialog.Close className="rounded-full p-2 text-mute transition hover:bg-surface-3 hover:text-bone" aria-label="Close">
                <X className="size-4" />
              </Dialog.Close>
            )}
          </div>

          {step.kind === "form" && (
            <form onSubmit={submit} noValidate className="mt-5">
              <Dialog.Title className="display text-2xl font-semibold">Connect your agent</Dialog.Title>
              <Dialog.Description className="mt-2 text-[15px] leading-relaxed text-fog">
                {site.name} issues a key for your agent and shows it once. You draft launches; the agent submits them
                through the MCP server with that key.
              </Dialog.Description>
              <label htmlFor="agent-name" className="mt-6 block text-sm text-fog">
                Agent name
              </label>
              <input
                id="agent-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder="e.g. Atlas"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "agent-name-error" : undefined}
                className="field mt-2"
              />
              {error && (
                <p id="agent-name-error" role="alert" className="mt-2 flex items-center gap-1.5 text-sm text-danger">
                  <TriangleAlert className="size-3.5" /> {error}
                </p>
              )}
              <button type="submit" disabled={pending} className="btn btn-ember btn-lg mt-6 w-full">
                {pending ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                {pending ? "Issuing key…" : "Issue agent key"}
              </button>
            </form>
          )}

          {step.kind === "key" && (
            <div className="mt-5">
              <Dialog.Title className="display text-2xl font-semibold">Save this key now</Dialog.Title>
              <Dialog.Description className="mt-2 text-[15px] leading-relaxed text-fog">
                This is the only time {site.name} shows it. Only a hash is stored, so a lost key means issuing a new one.
              </Dialog.Description>
              <div className="mt-5 flex items-center gap-2 rounded-xl border border-ember/30 bg-ember/5 p-3">
                <code className="min-w-0 flex-1 break-all font-mono text-[13px] text-bone">{step.key}</code>
                <button type="button" className="btn btn-ghost btn-sm shrink-0" onClick={() => copy(step.key, "key")}>
                  {copied === "key" ? <Check className="size-3.5 text-mint" /> : <Copy className="size-3.5" />}
                  {copied === "key" ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="label mt-6">MCP client config</p>
              <div className="relative mt-2">
                <pre className="overflow-x-auto rounded-xl border border-line bg-ink-2 p-4 font-mono text-[12px] leading-relaxed text-fog">
                  {mcpConfig(step.key)}
                </pre>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm absolute right-2 top-2 bg-surface"
                  onClick={() => copy(mcpConfig(step.key), "config")}
                >
                  {copied === "config" ? <Check className="size-3.5 text-mint" /> : <Copy className="size-3.5" />}
                  {copied === "config" ? "Copied" : "Copy"}
                </button>
              </div>
              <label className="mt-6 flex cursor-pointer items-center gap-3 text-sm text-fog">
                <input
                  type="checkbox"
                  checked={saved}
                  onChange={(e) => setSaved(e.target.checked)}
                  className="size-4 accent-[var(--color-ember)]"
                />
                I saved the key somewhere safe
              </label>
              <button type="button" disabled={!saved} onClick={finish} className="btn btn-primary btn-lg mt-5 w-full">
                Done
              </button>
            </div>
          )}

          {step.kind === "connected" && agent && (
            <div className="mt-5">
              <Dialog.Title className="display text-2xl font-semibold">{agent.name}</Dialog.Title>
              <Dialog.Description className="mt-2 text-[15px] text-fog">
                Connected in this browser. The agent authenticates with its own key.
              </Dialog.Description>
              <dl className="mt-6 divide-y divide-line rounded-2xl border border-line text-sm">
                <div className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-mute">Key</dt>
                  <dd className="font-mono">{agent.keyPrefix}••••••••</dd>
                </div>
                <div className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-mute">Issued</dt>
                  <dd>{new Date(agent.createdAt).toLocaleString()}</dd>
                </div>
                <div className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-mute">Endpoint</dt>
                  <dd className="font-mono">/api/mcp</dd>
                </div>
              </dl>
              <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button type="button" className="btn btn-ghost" onClick={() => setStep({ kind: "form" })}>
                  Issue a new key
                </button>
                <button
                  type="button"
                  className="btn btn-ghost text-danger hover:text-danger"
                  onClick={() => {
                    setAgent(null);
                    onOpenChange(false);
                    toast({ kind: "info", title: "Agent forgotten on this browser" });
                  }}
                >
                  Forget on this browser
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
