"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, CheckCircle2, Footprints, Hourglass, ImagePlus, Info, ShieldCheck, Sparkles, TrendingUp, Upload, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState, Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/dashboard/StatCard";
import { cn } from "@/lib/cn";
import { api } from "@/lib/fetcher";
import { fmtAmount, fmtDate, fmtSteps } from "@/lib/format";

interface Entry {
  id: string;
  day: string;
  steps: number;
  source: string;
  verification: string;
  flags: string[];
  reviewNote: string | null;
  hasProof: boolean;
  estimate: number;
  createdAt: string;
}

interface StepsResponse {
  steps: Entry[];
  summary: {
    daysLogged7: number;
    avgSteps7: number;
    avgDaily7: number;
    week7: number;
    inReview: number;
    verified: number;
    goal: number;
    today: string;
    tokenSymbol: string;
  };
}

/** Uploads may cover today and the six days before it. */
const UPLOAD_WINDOW_DAYS = 7;

/** Downscales a screenshot to a JPEG data URL small enough to upload quickly. */
async function compressScreenshot(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This image format is not supported. Use a JPG or PNG screenshot.");
  }
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read the image.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

function celebrate() {
  const colors = ["#c4fb6d", "#5dff9d", "#ffffff", "#d8ff9c"];
  confetti({ particleCount: 110, spread: 75, origin: { y: 0.4 }, colors, scalar: 0.9 });
}

export function StepsUploadView() {
  const { data, isLoading, error } = useQuery({ queryKey: ["steps"], queryFn: () => api<StepsResponse>("/api/steps") });

  if (isLoading || !data) {
    if (error) return <EmptyState title="Could not load your steps">{(error as Error).message}</EmptyState>;
    return (
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-[520px] lg:col-span-2" />
        <Skeleton className="h-[520px]" />
      </div>
    );
  }

  const { summary, steps } = data;
  const token = summary.tokenSymbol;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="label">Upload steps</div>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Log your day. <span className="text-white/40">See what it earns.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] text-white/55">
          Upload your daily steps with a screenshot from your health app. The team checks it, and your average earnings
          update as you go.
        </p>
      </motion.div>

      <div className="grid gap-5 lg:grid-cols-3">
        <UploadForm summary={summary} logged={steps} />
        <AverageCard summary={summary} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Average steps · 7 days" value={summary.avgSteps7} decimals={0} hint={`${summary.daysLogged7} of 7 days logged`} icon={Footprints} />
        <StatCard label="This week · estimate" value={summary.week7} prefix="$" suffix={token} hint="Days logged in the last 7" icon={CalendarDays} delay={0.05} />
        <StatCard label="In review · estimate" value={summary.inReview} prefix="$" suffix={token} hint="Waiting for the team" icon={Hourglass} delay={0.1} />
        <StatCard label="Verified · estimate" value={summary.verified} prefix="$" suffix={token} hint="Counts at the next distribution" icon={CheckCircle2} delay={0.15} accent />
      </div>

      <History steps={steps} token={token} />
    </div>
  );
}

function UploadForm({ summary, logged }: { summary: StepsResponse["summary"]; logged: Entry[] }) {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const days = useMemo(() => {
    const base = new Date(`${summary.today}T00:00:00Z`).getTime();
    return Array.from({ length: UPLOAD_WINDOW_DAYS }, (_, i) => new Date(base - i * 86_400_000).toISOString().slice(0, 10));
  }, [summary.today]);
  const loggedDays = useMemo(() => new Set(logged.filter((e) => e.source === "manual_demo").map((e) => e.day)), [logged]);

  const [day, setDay] = useState(() => days.find((d) => !loggedDays.has(d)) ?? days[0]);
  const [steps, setSteps] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<Entry | null>(null);

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    try {
      setProof(await compressScreenshot(file));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setReading(false);
    }
  };

  const upload = useMutation({
    mutationFn: () => api<{ entry: Entry }>("/api/steps", { method: "POST", json: { day, steps: Number(steps), proof } }),
    onSuccess: async ({ entry }) => {
      setResult(entry);
      setSteps("");
      setProof(null);
      const next = days.find((d) => d !== entry.day && !loggedDays.has(d));
      if (next) setDay(next);
      await qc.invalidateQueries({ queryKey: ["steps"] });
      await qc.invalidateQueries({ queryKey: ["me"] });
      if (entry.steps >= summary.goal) celebrate();
      toast.success("Steps uploaded", { description: "The team will review your screenshot." });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const n = Number(steps);
  const validSteps = steps !== "" && Number.isInteger(n) && n >= 0 && n <= 100_000;
  const already = loggedDays.has(day);
  const ready = validSteps && Boolean(proof) && !already;

  return (
    <Card className="relative overflow-hidden p-6 sm:p-7 lg:col-span-2">
      <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-lime-400/10 blur-3xl" />
      <CardHeader label="New upload" title="Your daily steps" />

      <form
        className="relative mt-6 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) upload.mutate();
        }}
      >
        <div>
          <span className="label mb-2.5 block">Day</span>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((d, i) => {
              const done = loggedDays.has(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDay(d)}
                  className={cn(
                    "relative flex min-w-[68px] shrink-0 flex-col items-center rounded-2xl border px-3 py-2.5 transition",
                    day === d ? "border-lime-400/60 bg-lime-400/10 text-lime-200" : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25 hover:text-white",
                  )}
                >
                  <span className="font-mono text-[10px] uppercase tracking-widest opacity-70">
                    {i === 0 ? "Today" : fmtDate(d, { weekday: "short" })}
                  </span>
                  <span className="mt-0.5 font-display text-lg font-semibold">{fmtDate(d, { day: "numeric" })}</span>
                  {done && <CheckCircle2 className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-ink-900 text-lime-400" />}
                </button>
              );
            })}
          </div>
          {already && <p className="mt-2 text-[12px] text-amber-200/80">You already uploaded this day. Pick another one.</p>}
        </div>

        <label className="block">
          <span className="label mb-2.5 block">Steps</span>
          <div className="relative">
            <Footprints className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-lime-400/70" />
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={100000}
              step={1}
              className="input h-14 !pl-12 font-mono text-2xl"
              placeholder="8432"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              required
            />
          </div>
          {validSteps && (
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-lime-500 to-lime-300"
                animate={{ width: `${Math.min(100, (n / summary.goal) * 100)}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
          )}
          {validSteps && (
            <span className="mt-1.5 block text-[11.5px] text-white/40">
              {n >= summary.goal ? "Daily goal reached" : `${fmtSteps(summary.goal - n)} steps to the daily goal`}
            </span>
          )}
        </label>

        <div>
          <span className="label mb-2.5 block">Screenshot</span>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void pickFile(e.target.files?.[0]);
              e.target.value = ""; // so choosing the same file again still fires
            }}
          />
          {proof ? (
            <div className="flex items-center gap-4 rounded-2xl border border-lime-400/25 bg-lime-400/[0.05] p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={proof} alt="Screenshot preview" className="h-20 w-16 rounded-lg object-cover object-top" />
              <div className="flex-1 text-[13px]">
                <div className="flex items-center gap-1.5 font-medium text-lime-200">
                  <CheckCircle2 className="h-4 w-4" /> Screenshot ready
                </div>
                <div className="mt-0.5 text-white/45">Make sure the date and step count are visible.</div>
              </div>
              <button type="button" onClick={() => setProof(null)} className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-white" aria-label="Remove screenshot">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void pickFile(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-8 text-center transition",
                dragging ? "border-lime-400/70 bg-lime-400/[0.07]" : "border-white/15 bg-white/[0.02] hover:border-lime-400/40 hover:bg-white/[0.04]",
              )}
            >
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-lime-400/10 text-lime-300">
                <ImagePlus className="h-5 w-5" />
              </span>
              <span className="text-sm font-medium">{reading ? "Reading image…" : "Add a screenshot of your health app"}</span>
              <span className="text-[12px] text-white/40">Apple Health, Google Fit or Samsung Health · drag it here or tap to choose</span>
            </button>
          )}
        </div>

        <Button type="submit" size="lg" className="w-full" loading={upload.isPending} disabled={!ready} icon={<Upload className="h-4 w-4" />}>
          Upload steps
        </Button>
        <p className="flex items-start gap-2 text-[12px] leading-relaxed text-white/40">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-lime-400/70" />
          Uploads count only after the team checks your screenshot. Entries can&apos;t be edited after upload.
        </p>
      </form>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="relative mt-6 flex items-center gap-4 rounded-2xl border border-lime-400/30 bg-lime-400/[0.08] p-4"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-lime-400 text-ink-950">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <div className="text-[13px] text-white/65">
                {fmtDate(result.day, { weekday: "long", month: "short", day: "numeric" })} · {fmtSteps(result.steps)} steps
              </div>
              <div className="font-display text-xl font-semibold text-lime-200">
                {result.estimate > 0 ? `≈ $${fmtAmount(result.estimate)} ${summary.tokenSymbol} estimated` : "Below the minimum to earn for a day"}
              </div>
              <div className="text-[11.5px] text-white/40">Pending review · estimate, not guaranteed</div>
            </div>
            <button onClick={() => setResult(null)} className="rounded-lg p-1.5 text-white/40 hover:text-white" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function AverageCard({ summary }: { summary: StepsResponse["summary"] }) {
  const has = summary.daysLogged7 > 0;
  return (
    <Card className="relative flex flex-col overflow-hidden p-6 sm:p-7">
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-lime-400/20 blur-3xl" />
      <CardHeader label="Your average" title="Daily earnings" action={<TrendingUp className="h-5 w-5 text-lime-400" />} />
      <div className="relative mt-8">
        <div className="font-display text-6xl font-bold tracking-tight text-lime-300 tabular">
          {has ? `$${fmtAmount(summary.avgDaily7)}` : "—"}
        </div>
        <div className="mt-2 text-sm text-white/50">{has ? `${summary.tokenSymbol} per day · last 7 days` : "Upload your first day to see it"}</div>
      </div>
      <div className="relative mt-8 flex gap-1.5">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className={cn("h-2 flex-1 rounded-full", i < summary.daysLogged7 ? "bg-lime-400 shadow-[0_0_10px_rgba(196,251,109,0.5)]" : "bg-white/10")} />
        ))}
      </div>
      <div className="relative mt-2 text-[12px] text-white/45">{summary.daysLogged7} of the last 7 days uploaded</div>
      <dl className="relative mt-8 space-y-3 border-t border-white/10 pt-5 text-sm">
        <div className="flex justify-between">
          <dt className="text-white/50">Average steps</dt>
          <dd className="font-mono">{has ? fmtSteps(summary.avgSteps7) : "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-white/50">Estimated month</dt>
          <dd className="font-mono text-lime-300">{has ? `$${fmtAmount(summary.avgDaily7 * 30)}` : "—"}</dd>
        </div>
      </dl>
      <p className="relative mt-auto flex gap-2 pt-6 text-[11.5px] leading-relaxed text-white/40">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Estimates based on the days you uploaded. The amount paid is set after review and is not guaranteed.
      </p>
    </Card>
  );
}

function History({ steps, token }: { steps: Entry[]; token: string }) {
  return (
    <Card className="overflow-hidden">
      <div className="p-6 pb-4">
        <CardHeader label="Last 30 days" title="Your uploads" />
      </div>
      {steps.length === 0 ? (
        <div className="px-6 pb-6">
          <EmptyState title="No uploads yet">Your uploaded days and their estimated earnings appear here.</EmptyState>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead className="border-y border-white/10 bg-white/[0.02]">
              <tr>
                <th className="table-head">Day</th>
                <th className="table-head">Steps</th>
                <th className="table-head">Screenshot</th>
                <th className="table-head">Status</th>
                <th className="table-head text-right">Estimated</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((e) => (
                <tr key={e.id} className="border-b border-white/5 last:border-0">
                  <td className="table-cell">
                    {fmtDate(e.day, { weekday: "short", month: "short", day: "numeric" })}
                    {e.reviewNote && e.verification === "rejected" && <div className="text-[11px] text-red-300/70">{e.reviewNote}</div>}
                  </td>
                  <td className="table-cell font-mono">{fmtSteps(e.steps)}</td>
                  <td className="table-cell text-[12.5px] text-white/55">{e.hasProof ? "Attached" : e.source === "manual_demo" ? "—" : "Health app"}</td>
                  <td className="table-cell">
                    <StatusBadge status={e.verification === "flagged" ? "unverified" : e.verification} />
                  </td>
                  <td className={cn("table-cell text-right font-mono", e.estimate > 0 ? "text-lime-300" : "text-white/30")}>
                    ${fmtAmount(e.estimate)} <span className="text-white/35">{token}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
