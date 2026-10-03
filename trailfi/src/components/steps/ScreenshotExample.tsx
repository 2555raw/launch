import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";

const BARS = [0, 0, 0, 0, 0, 0, 0, 8, 46, 62, 30, 12, 18, 40, 24, 10, 6, 52, 34, 20, 8, 0, 0, 0];

/** Numbered marker placed on the phone, matched by the list next to it. */
function Marker({ n, className }: { n: number; className: string }) {
  return (
    <span
      className={cn(
        "absolute z-10 grid h-6 w-6 place-items-center rounded-full bg-lime-400 font-mono text-[11px] font-bold text-ink-950 shadow-[0_0_0_4px_rgba(196,251,109,0.25)]",
        className,
      )}
    >
      {n}
    </span>
  );
}

/** A health app "Steps" screen on a phone: what a good screenshot looks like. */
export function PhoneMock({ className }: { className?: string }) {
  return (
    <div className={cn("relative mx-auto w-[236px] rounded-[42px] border border-white/15 bg-[#0b0c0d] p-[9px] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.9)]", className)}>
      <div className="relative overflow-hidden rounded-[34px] bg-white text-[#1c1c1e]">
        {/* Status bar and notch */}
        <div className="flex items-center justify-between px-6 pb-1 pt-2.5 text-[10px] font-semibold">
          <span>10:09</span>
          <span className="absolute left-1/2 top-1.5 h-[18px] w-[78px] -translate-x-1/2 rounded-full bg-black" />
          <span className="flex items-center gap-1">
            <span className="h-[7px] w-[14px] rounded-[2px] border border-[#1c1c1e]/70" />
          </span>
        </div>

        <div className="px-3 pb-3">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[#007aff]">‹ Activity</span>
            <span className="font-semibold">Steps</span>
            <span className="text-[#007aff]">Add Data</span>
          </div>

          <div className="relative mt-2 grid grid-cols-4 rounded-md bg-[#eeeef0] p-[2px] text-center text-[8.5px] font-medium text-[#3c3c43]">
            <span className="rounded-[5px] bg-white py-[3px] shadow-sm">D</span>
            <span className="py-[3px]">W</span>
            <span className="py-[3px]">M</span>
            <span className="py-[3px]">Y</span>
            <Marker n={1} className="-right-2 -top-2.5" />
          </div>

          <div className="relative mt-2.5">
            <div className="text-[7.5px] font-semibold uppercase tracking-wide text-[#8e8e93]">Total</div>
            <div className="relative flex w-fit items-baseline gap-1">
              <span className="text-[22px] font-bold leading-tight tracking-tight">8,432</span>
              <span className="text-[10px] font-semibold text-[#8e8e93]">steps</span>
              <span className="pointer-events-none absolute -inset-x-1.5 -inset-y-0.5 rounded-md border-2 border-lime-400" />
              <Marker n={3} className="-right-9 top-1/2 -translate-y-1/2" />
            </div>
            <div className="relative mt-1 w-fit text-[9.5px] text-[#8e8e93]">
              Thu, Oct 2, 2026
              <span className="pointer-events-none absolute -inset-x-1.5 -inset-y-0.5 rounded-md border-2 border-lime-400" />
              <Marker n={2} className="-right-9 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Steps per hour */}
          <div className="relative mt-3 h-[96px] border-b border-[#e5e5ea]">
            {[0.33, 0.66].map((t) => (
              <span key={t} className="absolute inset-x-0 border-t border-dashed border-[#e5e5ea]" style={{ top: `${t * 100}%` }} />
            ))}
            <div className="absolute inset-0 flex items-end gap-[2px] pr-5">
              {BARS.map((h, i) => (
                <span key={i} className="flex-1 rounded-t-[1.5px] bg-[#ff5a1f]" style={{ height: `${h}%` }} />
              ))}
            </div>
            <span className="absolute right-0 top-0 text-[6.5px] text-[#8e8e93]">2,000</span>
          </div>
          <div className="mt-1 flex justify-between pr-5 text-[6.5px] text-[#8e8e93]">
            <span>12 AM</span>
            <span>6</span>
            <span>12 PM</span>
            <span>6</span>
          </div>
        </div>

        <div className="bg-[#f2f2f7] px-3 pb-4 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold">Highlights</span>
            <span className="text-[8.5px] text-[#007aff]">Show All</span>
          </div>
          <div className="mt-2 rounded-lg bg-white p-2.5">
            <div className="text-[8px] font-semibold text-[#ff5a1f]">Steps</div>
            <div className="mt-1 text-[9px] font-semibold leading-snug">You&apos;re averaging more steps a day this month than last month.</div>
            <div className="mt-2 h-[6px] rounded-full bg-[#ff5a1f]" />
          </div>
        </div>
      </div>
    </div>
  );
}

const MARKS = [
  { n: 1, title: "Day view", body: "In your health app open Steps and pick the day (D) view." },
  { n: 2, title: "The date", body: "The day you're uploading must show on screen." },
  { n: 3, title: "Total steps", body: "The day's total, the same number you type in." },
];

/** "What to upload" card for the upload page. */
export function ScreenshotExample() {
  return (
    <section id="example" className="glass scroll-mt-24 overflow-hidden rounded-3xl">
      <div className="grid items-center gap-8 p-6 sm:p-8 md:grid-cols-[auto_1fr] md:gap-12">
        <div className="relative">
          <div className="pointer-events-none absolute inset-0 -z-10 m-auto h-64 w-64 rounded-full bg-lime-400/15 blur-3xl" />
          <PhoneMock />
        </div>

        <div>
          <div className="label">Example</div>
          <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight">What your screenshot should look like</h2>
          <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-white/55">
            Take a screenshot of the Steps screen in your health app. Apple Health, Google Fit, Samsung Health, Fitbit and Garmin
            all have one. The team checks it against the number you type.
          </p>

          <ol className="mt-6 space-y-3">
            {MARKS.map((m) => (
              <li key={m.n} className="flex gap-3.5">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-lime-400 font-mono text-[11px] font-bold text-ink-950">{m.n}</span>
                <div className="text-[14px] leading-snug">
                  <span className="font-semibold text-white">{m.title}</span>
                  <span className="text-white/55"> · {m.body}</span>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-6 grid gap-2 text-[13px] sm:grid-cols-2">
            {["Full screenshot, straight from your phone", "One screenshot per day"].map((t) => (
              <span key={t} className="flex items-center gap-2 text-white/70">
                <Check className="h-4 w-4 shrink-0 text-lime-400" /> {t}
              </span>
            ))}
            {["Cropped or edited images", "Photos of another screen"].map((t) => (
              <span key={t} className="flex items-center gap-2 text-white/45">
                <X className="h-4 w-4 shrink-0 text-red-300/80" /> {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
