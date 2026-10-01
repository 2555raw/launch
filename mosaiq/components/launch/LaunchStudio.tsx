"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  Bot,
  Check,
  CircleCheck,
  Copy,
  ImagePlus,
  LoaderCircle,
  RotateCcw,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { buildHandoff } from "@/lib/handoff";
import { basePairs, chains, getAsset, getChain, getPad, isValidPair, padsOn, pairOptions, pairsLabel, resolveSelection, stocks, supportsStocks, type ChainId } from "@/lib/pads";
import { DESCRIPTION_MAX, draftInputSchema, fieldErrors } from "@/lib/schemas";
import { site } from "@/lib/site";
import type { PublicLaunch } from "@/lib/types";
import { useApp } from "@/components/shell/AppProvider";
import { AssetIcon, ChainDot, PadGlyph } from "@/components/ui/PadGlyph";
import { useCopy } from "@/components/ui/useCopy";
import { onchainPads, onchainSupport, supportsOpeningBuy } from "@/lib/onchain";
import { OnChainLaunch } from "./OnChainLaunch";
import { prepareImage } from "./image";

type Mode = "create" | "import";
interface Form {
  mode: Mode;
  chain: ChainId;
  pad: string;
  pair: string;
  name: string;
  ticker: string;
  image?: string;
  x: string;
  websiteMode: "hosted" | "custom";
  website: string;
  description: string;
  openingBuy: string;
  address: string;
}

type Submit =
  | { state: "idle" }
  | { state: "submitting" }
  | { state: "error"; message: string }
  | { state: "done"; id: string; url: string; handoff: string };

const AUTOSAVE_KEY = "picker.studio.v1";
const sections = [
  { id: "studio-network", label: "Network & launchpad" },
  { id: "studio-details", label: "Token details" },
  { id: "studio-settings", label: "Launch settings" },
];

export function LaunchStudio({
  initial,
  draft,
}: {
  initial: { chain?: string; pad?: string; pair?: string; mode?: string };
  draft?: PublicLaunch | null;
}) {
  const pathname = usePathname();
  const { agent, openConnect, toast } = useApp();
  const { copied, copy } = useCopy();

  const [form, setForm] = useState<Form>(() => {
    const sel = resolveSelection(draft ?? initial);
    return {
      mode: draft?.mode ?? (initial.mode === "import" ? "import" : "create"),
      chain: sel.chain.id,
      pad: sel.pad.id,
      pair: sel.pair,
      name: draft?.name ?? "",
      ticker: draft?.ticker ?? "",
      image: draft?.image,
      x: draft?.x ?? "",
      websiteMode: draft?.website ? "custom" : "hosted",
      website: draft?.website ?? "",
      description: draft?.description ?? "",
      openingBuy: draft?.openingBuy ?? "",
      address: draft?.address ?? "",
    };
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [submit, setSubmit] = useState<Submit>({ state: "idle" });
  const [imageState, setImageState] = useState<{ busy: boolean; error?: string }>({ busy: false });
  const [origin, setOrigin] = useState(site.url);
  const restored = useRef(false);

  useEffect(() => setOrigin(window.location.origin), []);

  // Restore text fields from the last visit (not when opening a saved draft).
  useEffect(() => {
    if (draft || restored.current) return;
    restored.current = true;
    try {
      const saved = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) ?? "null") as Partial<Form> | null;
      if (saved && (saved.name || saved.ticker || saved.description)) {
        setForm((f) => ({
          ...f,
          name: saved.name ?? "",
          ticker: saved.ticker ?? "",
          x: saved.x ?? "",
          description: saved.description ?? "",
          websiteMode: saved.websiteMode ?? "hosted",
          website: saved.website ?? "",
        }));
      }
    } catch {
      /* storage unavailable */
    }
  }, [draft]);

  useEffect(() => {
    if (draft) return;
    const t = setTimeout(() => {
      try {
        const { image: _image, ...rest } = form;
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(rest));
      } catch {
        /* storage unavailable */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [form, draft]);

  // Keep chain/pad/pair/mode in the URL so a studio setup can be shared.
  useEffect(() => {
    // The History API updates the address bar without a server round trip or a remount.
    const q = new URLSearchParams({ chain: form.chain, pad: form.pad, pair: form.pair });
    if (form.mode === "import") q.set("mode", "import");
    if (draft) q.set("draft", draft.id);
    window.history.replaceState(null, "", `${pathname}?${q.toString()}`);
  }, [form.chain, form.pad, form.pair, form.mode, pathname, draft]);

  const chain = getChain(form.chain)!;
  const pad = getPad(form.pad)!;
  const [stockPicker, setStockPicker] = useState(false);

  const support = onchainSupport(form);
  const onchain = support !== null;
  const buyAllowed = !onchain || supportsOpeningBuy(form);
  /** On-chain buys are paid in the pair itself (ETH, USDG, a stock token…). */
  const buyUnit = onchain ? form.pair : chain.native;

  const payload = useMemo(
    () => ({
      mode: form.mode,
      chain: form.chain,
      pad: form.pad,
      pair: form.pair,
      name: form.name,
      ticker: form.ticker,
      image: form.image,
      x: form.x,
      websiteMode: form.websiteMode,
      website: form.websiteMode === "custom" ? form.website : undefined,
      description: form.description,
      openingBuy: form.mode === "create" && buyAllowed ? form.openingBuy : undefined,
      address: form.mode === "import" ? form.address : undefined,
    }),
    [form, buyAllowed],
  );

  const clientErrors = useMemo(() => {
    const r = draftInputSchema.safeParse(payload);
    const errors = r.success ? {} : fieldErrors(r.error);
    if (onchain && !payload.image && !errors.image) errors.image = `${pad.name} launches need a token image`;
    return errors;
  }, [payload, onchain]);

  const errorFor = (field: string) => (submitted || touched[field] ? (serverErrors[field] ?? clientErrors[field]) : undefined);

  const update = useCallback(<K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setServerErrors((e) => (e[key as string] ? { ...e, [key as string]: "" } : e));
    setSubmit((s) => (s.state === "error" ? { state: "idle" } : s));
  }, []);

  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }));

  function selectChain(id: ChainId) {
    const first = padsOn(id)[0];
    setForm((f) => ({ ...f, chain: id, pad: first.id, pair: pairOptions(first)[0], address: f.chain === id ? f.address : "" }));
  }
  function selectPad(id: string) {
    const p = getPad(id)!;
    setForm((f) => ({ ...f, pad: id, pair: isValidPair(p, f.pair) ? f.pair : pairOptions(p)[0] }));
  }

  async function onImage(file: File | undefined) {
    if (!file) return;
    setImageState({ busy: true });
    try {
      update("image", await prepareImage(file));
      setImageState({ busy: false });
    } catch (err) {
      setImageState({ busy: false, error: err instanceof Error ? err.message : "Could not use that image." });
    }
  }

  const handoff = buildHandoff(
    {
      mode: form.mode,
      chain: form.chain,
      pad: form.pad,
      pair: form.pair,
      name: form.name,
      ticker: form.ticker,
      description: form.description,
      openingBuy: form.openingBuy,
      address: form.address,
      hasImage: Boolean(form.image),
    },
    origin,
  );

  /** Show every field error and focus the first; true when the form is ready. */
  function validate(): boolean {
    setSubmitted(true);
    const first = Object.keys(clientErrors)[0];
    if (!first) return true;
    const el = document.getElementById(`field-${first}`);
    el?.focus();
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    return false;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) {
      setSubmit({ state: "error", message: "Some fields need attention before the draft can be saved." });
      return;
    }
    setSubmit({ state: "submitting" });
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.fields) setServerErrors(data.fields);
        throw new Error(data.error ?? `Request failed (${res.status}).`);
      }
      setSubmit({ state: "done", id: data.id, url: data.url, handoff: data.handoff });
      try {
        localStorage.removeItem(AUTOSAVE_KEY);
      } catch {
        /* storage unavailable */
      }
      toast({ kind: "success", title: "Draft saved", body: "Hand the note to your agent to launch it." });
    } catch (err) {
      setSubmit({ state: "error", message: err instanceof Error ? err.message : "Network error. Try again." });
    }
  }

  function reset() {
    const sel = resolveSelection({ chain: form.chain, pad: form.pad });
    setForm({
      mode: form.mode,
      chain: sel.chain.id,
      pad: sel.pad.id,
      pair: sel.pair,
      name: "",
      ticker: "",
      image: undefined,
      x: "",
      websiteMode: "hosted",
      website: "",
      description: "",
      openingBuy: "",
      address: "",
    });
    setTouched({});
    setSubmitted(false);
    setServerErrors({});
    setSubmit({ state: "idle" });
  }

  const active = useScrollSpy(sections.map((s) => s.id));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-6 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <nav aria-label="Breadcrumb" className="text-sm text-mute">
            <Link href="/" className="hover:text-bone">
              {site.name}
            </Link>{" "}
            / <span className="text-fog">Launch studio</span>
          </nav>
          <h1 className="display mt-3 text-[clamp(2.25rem,5vw,3.5rem)] font-semibold leading-none">
            {form.mode === "create" ? "Shape it. Hand it off." : "Bring an existing token."}
          </h1>
          <p className="mt-3 text-fog">
            {form.mode === "create"
              ? "Choose a pad, set the details, and let your agent place the launch."
              : "List a token already live on a pad. Your agent confirms the import."}
          </p>
        </div>
        <div role="tablist" aria-label="Studio mode" className="inline-flex shrink-0 self-start rounded-xl border border-line-strong bg-surface p-1 sm:self-auto">
          {(["create", "import"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={form.mode === m}
              onClick={() => update("mode", m)}
              className="relative rounded-lg px-6 py-2.5 text-sm font-medium capitalize text-fog transition-colors aria-selected:text-white"
            >
              {form.mode === m && (
                <motion.span layoutId="mode-pill" className="absolute inset-0 rounded-lg bg-[linear-gradient(180deg,#3b82f6,#2563eb)] shadow-[0_6px_20px_-8px_rgb(37_99_235/0.45)]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
              )}
              <span className="relative">{m}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <form onSubmit={onSubmit} noValidate className="space-y-6" aria-label="Launch draft">
          {/* 01 */}
          <Section id="studio-network" n="01" title="Network & launchpad">
            <Fieldset legend="Chain">
              <div role="radiogroup" aria-label="Chain" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {chains.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={form.chain === c.id}
                    onClick={() => selectChain(c.id)}
                    className={cn(
                      "flex h-12 items-center gap-2.5 rounded-xl border px-3 text-sm transition-colors",
                      form.chain === c.id ? "border-accent bg-accent/10 text-accent shadow-[0_0_18px_-6px_rgb(37_99_235/0.45)]" : "border-line-strong text-fog hover:border-accent/50 hover:text-bone",
                    )}
                  >
                    <ChainDot chain={c.id} className="size-6" />
                    <span className="truncate">{c.short}</span>
                  </button>
                ))}
              </div>
            </Fieldset>

            <Fieldset legend="Launchpad">
              <div role="radiogroup" aria-label="Launchpad" className="grid grid-cols-1 gap-2">
                {padsOn(form.chain).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={form.pad === p.id}
                    onClick={() => selectPad(p.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors",
                      form.pad === p.id ? "border-accent bg-accent/10 shadow-[0_0_18px_-6px_rgb(37_99_235/0.45)]" : "border-line-strong hover:border-accent/50",
                    )}
                  >
                    <PadGlyph pad={p.id} size="md" className="!rounded-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{p.name}</span>
                      <span className="hidden truncate text-xs text-mute sm:block">{p.blurb}</span>
                    </span>
                    <span aria-hidden="true" className={cn("mr-1 size-1.5 rounded-full", form.pad === p.id ? "bg-accent-2 shadow-[0_0_8px_1px_rgb(14_165_233/0.6)]" : "bg-transparent")} />
                  </button>
                ))}
              </div>
            </Fieldset>

            <Fieldset legend="Pair">
              <div role="radiogroup" aria-label="Pair" className="flex flex-wrap gap-2">
                {basePairs(pad).map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    role="radio"
                    aria-checked={form.pair === sym}
                    onClick={() => {
                      update("pair", sym);
                      setStockPicker(false);
                    }}
                    className="pair-chip"
                  >
                    <AssetIcon symbol={sym} />
                    {sym}
                  </button>
                ))}
                {supportsStocks(pad) && getAsset(form.pair)?.stock && (
                  <button type="button" role="radio" aria-checked className="pair-chip">
                    <AssetIcon symbol={form.pair} />
                    {form.pair}
                  </button>
                )}
                {supportsStocks(pad) && (
                  <button
                    type="button"
                    aria-expanded={stockPicker}
                    aria-controls="stock-picker"
                    onClick={() => setStockPicker((o) => !o)}
                    className="pair-chip"
                  >
                    <AssetIcon symbol="SPY" />
                    {stockPicker ? "Close" : "More"}
                  </button>
                )}
              </div>
              <AnimatePresence initial={false}>
                {stockPicker && supportsStocks(pad) && (
                  <motion.div
                    id="stock-picker"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div role="radiogroup" aria-label="Stock pair" className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-line bg-ink-2 p-2 sm:grid-cols-4">
                      {stocks.map((st) => (
                        <button
                          key={st.symbol}
                          type="button"
                          role="radio"
                          aria-checked={form.pair === st.symbol}
                          onClick={() => {
                            update("pair", st.symbol);
                            setStockPicker(false);
                          }}
                          className={cn(
                            "flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                            form.pair === st.symbol ? "bg-surface-3 text-bone" : "text-fog hover:bg-surface-2 hover:text-bone",
                          )}
                        >
                          <AssetIcon symbol={st.symbol} className="size-6" />
                          <span className="min-w-0">
                            <span className="block font-medium">{st.symbol}</span>
                            <span className="block truncate text-[11px] text-mute">{st.name}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <p className="mt-2 text-xs text-mute">
                {pad.name} pairs on {chain.name}: {pairsLabel(pad)}.
              </p>
            </Fieldset>
          </Section>

          {/* 02 */}
          <Section id="studio-details" n="02" title="Token details">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="name" label="Name" error={errorFor("name")} hint={`${form.name.length}/32`}>
                <input
                  id="field-name"
                  className="field"
                  value={form.name}
                  maxLength={32}
                  placeholder="Token name"
                  autoComplete="off"
                  onChange={(e) => update("name", e.target.value)}
                  onBlur={() => touch("name")}
                  aria-invalid={Boolean(errorFor("name"))}
                  aria-describedby="name-msg"
                />
              </Field>
              <Field id="ticker" label="Ticker" error={errorFor("ticker")}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-mute">$</span>
                  <input
                    id="field-ticker"
                    className="field pl-8 font-mono uppercase"
                    value={form.ticker}
                    maxLength={10}
                    placeholder="SYMBOL"
                    autoComplete="off"
                    onChange={(e) => update("ticker", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                    onBlur={() => touch("ticker")}
                    aria-invalid={Boolean(errorFor("ticker"))}
                    aria-describedby="ticker-msg"
                  />
                </div>
              </Field>
            </div>

            {form.mode === "import" && (
              <Field id="address" label={`Contract address on ${chain.name}`} error={errorFor("address")}>
                <input
                  id="field-address"
                  className="field font-mono text-sm"
                  value={form.address}
                  placeholder={chain.addressKind === "evm" ? "0x…" : "Base58 mint address"}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => update("address", e.target.value.trim())}
                  onBlur={() => touch("address")}
                  aria-invalid={Boolean(errorFor("address"))}
                  aria-describedby="address-msg"
                />
              </Field>
            )}

            <ImageDrop
              image={form.image}
              busy={imageState.busy}
              error={imageState.error ?? errorFor("image")}
              required={onchain}
              onFile={onImage}
              onClear={() => update("image", undefined)}
            />

            <Field id="x" label="X profile" optional error={errorFor("x")}>
              <input
                id="field-x"
                className="field"
                type="url"
                inputMode="url"
                value={form.x}
                placeholder="https://x.com/yourtoken"
                onChange={(e) => update("x", e.target.value)}
                onBlur={() => touch("x")}
                aria-invalid={Boolean(errorFor("x"))}
                aria-describedby="x-msg"
              />
            </Field>

            <Fieldset legend="Website">
              <div role="radiogroup" aria-label="Website" className="flex flex-wrap gap-2">
                <button type="button" role="radio" aria-checked={form.websiteMode === "hosted"} className="chip" onClick={() => update("websiteMode", "hosted")}>
                  {site.name} token page
                </button>
                <button type="button" role="radio" aria-checked={form.websiteMode === "custom"} className="chip" onClick={() => update("websiteMode", "custom")}>
                  Your own site
                </button>
              </div>
              <AnimatePresence initial={false} mode="wait">
                {form.websiteMode === "custom" ? (
                  <motion.div key="custom" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <Field id="website" label="Site URL" error={errorFor("website")} className="mt-3">
                      <input
                        id="field-website"
                        className="field"
                        type="url"
                        inputMode="url"
                        value={form.website}
                        placeholder="https://"
                        onChange={(e) => update("website", e.target.value)}
                        onBlur={() => touch("website")}
                        aria-invalid={Boolean(errorFor("website"))}
                        aria-describedby="website-msg"
                      />
                    </Field>
                  </motion.div>
                ) : (
                  <motion.p key="hosted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-2 text-xs text-mute">
                    The token gets a page on {site.name} with its chart link and socials.
                  </motion.p>
                )}
              </AnimatePresence>
            </Fieldset>
          </Section>

          {/* 03 */}
          <Section id="studio-settings" n="03" title="Launch settings">
            {form.mode === "create" && !buyAllowed && (
              <p className="rounded-xl border border-line bg-ink-2 p-3 text-sm text-fog">
                No opening buy with the {form.pair} pair on {pad.name}. {support?.buyPairs.length ? `Choose ${support.buyPairs.join(" or ")} to add one.` : ""}
              </p>
            )}
            {form.mode === "create" && buyAllowed && (
              <Field
                id="openingBuy"
                label={`Opening buy (${buyUnit})`}
                optional
                error={errorFor("openingBuy")}
                hint={`Leave empty for no dev buy. Minimum ${chain.minBuy} ${buyUnit} if set; it is paid from ${onchain ? "your" : "the agent's"} wallet.`}
              >
                <input
                  id="field-openingBuy"
                  className="field font-mono"
                  inputMode="decimal"
                  value={form.openingBuy}
                  placeholder={`min ${chain.minBuy}`}
                  onChange={(e) => update("openingBuy", e.target.value.replace(",", ".").replace(/[^0-9.]/g, ""))}
                  onBlur={() => touch("openingBuy")}
                  aria-invalid={Boolean(errorFor("openingBuy"))}
                  aria-describedby="openingBuy-msg"
                />
              </Field>
            )}

            <Field id="description" label="Description" optional error={errorFor("description")} hint={`${form.description.length}/${DESCRIPTION_MAX}`}>
              <textarea
                id="field-description"
                className="field min-h-28 resize-y py-3 leading-relaxed"
                value={form.description}
                maxLength={DESCRIPTION_MAX}
                placeholder="What is this token about?"
                onChange={(e) => update("description", e.target.value)}
                onBlur={() => touch("description")}
                aria-invalid={Boolean(errorFor("description"))}
                aria-describedby="description-msg"
              />
            </Field>

            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-fog">Agent wallet</p>
                <button type="button" onClick={openConnect} className="inline-flex items-center gap-2 text-sm text-bone underline decoration-accent/60 underline-offset-4 hover:decoration-accent">
                  <Bot className="size-4" aria-hidden="true" />
                  {agent ? `${agent.name} connected` : "Connect your agent"}
                </button>
              </div>
              <div className="mt-3 rounded-2xl border border-line bg-ink-2">
                <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                  <p className="text-sm font-semibold">Give this to your agent</p>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(handoff, "handoff")}>
                    {copied === "handoff" ? <Check className="size-3.5 text-mint" /> : <Copy className="size-3.5" />}
                    {copied === "handoff" ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="max-h-56 overflow-auto whitespace-pre-wrap p-4 font-mono text-[12px] leading-relaxed text-fog">{handoff}</pre>
              </div>
              <p className="mt-2 text-xs text-mute">
                {onchain
                  ? "An agent can launch it too, signing with its own Solana wallet. Save the draft to give it an id to act on."
                  : `People draft; only an agent holding a ${site.name} key can submit. Save the draft to give the agent an id it can act on.`}
              </p>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {submit.state === "done" ? (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-mint/30 bg-mint/5 p-5"
                  role="status"
                >
                  <p className="flex items-center gap-2 font-medium">
                    <CircleCheck className="size-5 text-mint" aria-hidden="true" /> Draft saved · <span className="font-mono text-sm">{submit.id}</span>
                  </p>
                  <p className="mt-2 text-sm text-fog">Give this note to your agent. It submits with <code className="font-mono text-bone">{onchain ? "prepare_launch" : "submit_launch"}</code>.</p>
                  <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-ink-2 p-4 font-mono text-[12px] leading-relaxed text-fog">
                    {submit.handoff}
                  </pre>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" className="btn btn-primary" onClick={() => copy(submit.handoff, "final")}>
                      {copied === "final" ? <Check className="size-4" /> : <Copy className="size-4" />}
                      {copied === "final" ? "Copied" : "Copy for your agent"}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => copy(submit.url, "link")}>
                      {copied === "link" ? <Check className="size-4 text-mint" /> : <ArrowUpRight className="size-4" />}
                      {copied === "link" ? "Link copied" : "Copy draft link"}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={reset}>
                      <RotateCcw className="size-4" /> New draft
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {onchain && (
                    <div className="mb-6">
                      <OnChainLaunch
                        wallet={support.wallet}
                        pad={form.pad}
                        payload={payload}
                        ticker={form.ticker}
                        openingBuy={form.openingBuy}
                        validate={validate}
                        onFieldErrors={setServerErrors}
                      />
                      <p className="mt-6 text-sm text-fog">Or save it for an agent to sign:</p>
                    </div>
                  )}
                  {form.mode === "create" && !onchain && (
                    <p className="mb-4 rounded-xl border border-line bg-ink-2 p-3 text-sm text-fog">
                      {onchainPads[form.pad]
                        ? `The ${form.pair} pair on ${pad.name} does not launch from a wallet yet. Choose ${onchainPads[form.pad].pairs.slice(0, 4).join(", ")}${onchainPads[form.pad].pairs.length > 4 ? "…" : ""} to launch it yourself.`
                        : `${pad.name} launches go through an agent for now: save the draft below and hand it over.`}
                    </p>
                  )}
                  {submit.state === "error" && (
                    <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
                      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {submit.message}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      className="btn btn-ghost btn-lg"
                      onClick={() => {
                        if (!agent) return openConnect();
                        copy(handoff, "bring");
                        toast({ kind: "success", title: "Note copied", body: `Paste it to ${agent.name}.` });
                      }}
                    >
                      Bring your agent
                    </button>
                    <button type="submit" disabled={submit.state === "submitting"} className="btn btn-accent btn-lg">
                      {submit.state === "submitting" ? <LoaderCircle className="size-4 animate-spin" /> : <Bot className="size-4" />}
                      {submit.state === "submitting" ? "Saving draft…" : "Save for your agent"}
                    </button>
                    <button type="button" className="btn btn-ghost text-fog" onClick={reset}>
                      Clear form
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Section>
        </form>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start" aria-label="Preview and sections">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line bg-surface-2/60 px-5 py-3.5">
              <p className="font-medium">Your launch</p>
              <span className="label">Preview</span>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-4">
                {form.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.image} alt="Token image preview" className="size-16 rounded-2xl object-cover" />
                ) : (
                  <span className="grid size-16 place-items-center rounded-2xl border border-dashed border-line-strong text-mute">
                    <ImagePlus className="size-6" aria-hidden="true" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className={cn("display truncate text-2xl font-semibold", !form.name && "text-mute")}>{form.name || "Token name"}</p>
                  <p className={cn("font-mono text-sm", form.ticker ? "text-fog" : "text-mute")}>${form.ticker || "SYMBOL"}</p>
                </div>
              </div>
              {form.description && <p className="mt-4 line-clamp-3 text-sm text-fog">{form.description}</p>}
              <dl className="mt-5 divide-y divide-line border-t border-line text-sm">
                <PreviewRow label="Network">
                  <ChainDot chain={chain.id} /> {chain.name}
                </PreviewRow>
                <PreviewRow label="Launchpad">
                  <PadGlyph pad={pad.id} size="sm" /> {pad.name}
                </PreviewRow>
                <PreviewRow label="Trading pair">
                  <AssetIcon symbol={form.pair} className="size-4" /> {form.pair}
                </PreviewRow>
                {form.mode === "create" && (
                  <PreviewRow label="Opening buy">
                    <span className="font-mono">{form.openingBuy ? `${form.openingBuy} ${chain.native}` : "None"}</span>
                  </PreviewRow>
                )}
              </dl>
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-ink-2 p-3 text-xs leading-relaxed text-fog">
                <Bot className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden="true" />
                {onchain
                  ? `Launches from your ${support?.wallet === "solana" ? "Solana" : "EVM"} wallet, or hand it to an agent.`
                  : agent
                    ? `${agent.name} will sign with its own wallet.`
                    : "Connect an agent to sign and submit this launch."}
              </p>
            </div>
          </div>

          <nav className="card hidden p-2 lg:block" aria-label="In this launch">
            <p className="px-3 pb-1 pt-2 text-xs text-mute">In this launch</p>
            {sections.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                aria-current={active === s.id ? "true" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active === s.id ? "bg-surface-3 text-bone" : "text-fog hover:text-bone",
                )}
              >
                <span className="font-mono text-xs text-mute">0{i + 1}</span>
                <span className="flex-1">{s.label}</span>
                <ArrowUpRight className="size-3.5 text-mute" aria-hidden="true" />
              </a>
            ))}
          </nav>
        </aside>
      </div>
    </div>
  );
}

function Section({ id, n, title, children }: { id: string; n: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="card p-5 sm:p-7">
      <div className="flex items-center gap-3 border-b border-line pb-5">
        <span className="grid size-8 place-items-center rounded-lg bg-surface-3 font-mono text-xs text-fog">{n}</span>
        <h2 id={`${id}-title`} className="text-lg font-medium">
          {title}
        </h2>
      </div>
      <div className="mt-6 space-y-6">{children}</div>
    </section>
  );
}

function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2.5 text-sm text-fog">{legend}</legend>
      {children}
    </fieldset>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  optional,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={`field-${id}`} className="mb-2 flex items-baseline justify-between text-sm text-fog">
        <span>
          {label} {optional && <span className="text-mute">(optional)</span>}
        </span>
      </label>
      {children}
      <p id={`${id}-msg`} className={cn("mt-1.5 min-h-4 text-xs", error ? "text-danger" : "text-mute")} role={error ? "alert" : undefined}>
        {error || hint}
      </p>
    </div>
  );
}

function PreviewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <dt className="text-mute">{label}</dt>
      <dd className="flex items-center gap-2 font-medium">{children}</dd>
    </div>
  );
}

function ImageDrop({
  image,
  busy,
  error,
  onFile,
  onClear,
  required,
}: {
  image?: string;
  busy: boolean;
  error?: string;
  onFile: (f: File | undefined) => void;
  onClear: () => void;
  required?: boolean;
}) {
  const inputId = "field-image";
  const [over, setOver] = useState(false);
  return (
    <div>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          onFile(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed p-4 transition-colors focus-within:border-accent/70",
          over ? "border-accent bg-accent/5" : error ? "border-danger/60" : "border-line-strong hover:border-accent/40 hover:bg-surface-2/40",
        )}
      >
        <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-3">
          {busy ? (
            <LoaderCircle className="size-5 animate-spin text-fog" aria-hidden="true" />
          ) : image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="size-full object-cover" />
          ) : (
            <Upload className="size-5 text-fog" aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Token image <span className="font-normal text-mute">{required ? "(required to launch)" : "(optional)"}</span></span>
          <span className="block text-xs text-mute">
            {busy ? "Optimising…" : image ? "Click or drop to replace" : "Drop an image, or click to upload. PNG, JPG, WebP or GIF, up to 5 MB."}
          </span>
        </span>
        <input
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      <div className="mt-1.5 flex min-h-4 items-center justify-between">
        <p className={cn("text-xs", error ? "text-danger" : "text-mute")} role={error ? "alert" : undefined}>
          {error ?? (image ? "Resized to 512px WebP in your browser." : "")}
        </p>
        {image && !busy && (
          <button type="button" onClick={onClear} className="inline-flex items-center gap-1 text-xs text-mute hover:text-bone">
            <X className="size-3" /> Remove
          </button>
        )}
      </div>
    </div>
  );
}

function useScrollSpy(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -55% 0px" },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return active;
}
