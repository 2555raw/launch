import { Icon } from "@/components/ui/Icons";

/**
 * The product, drawn rather than screenshotted: a real phone frame with the
 * real balance card and the real bottom bar, so the marketing page and the app
 * cannot drift apart visually.
 */
export function PhoneMock() {
  return (
    <div className="relative w-[300px] shrink-0 rounded-[38px] border border-hairStrong bg-ink p-2.5 shadow-float sm:w-[330px]">
      <div className="overflow-hidden rounded-[30px] bg-canvas">
        <div className="flex items-center justify-between px-5 pb-3 pt-5 text-[11px] text-muted">
          <span className="tnum">9:41</span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-positive" aria-hidden />
            Payence
          </span>
        </div>

        <div className="px-4">
          <div className="rounded-card bg-ink px-5 py-5 text-canvas">
            <p className="text-[11px] uppercase tracking-[0.1em] text-canvas/50">Total balance</p>
            <p className="tnum mt-1.5 text-[32px] font-extrabold tracking-[-0.03em]">€2,450.32</p>
            <div className="mt-4 flex gap-6 border-t border-hairDark pt-3 text-[11.5px]">
              <span>
                <span className="block text-canvas/50">Available</span>
                <span className="tnum mt-0.5 block font-semibold">€2,410.32</span>
              </span>
              <span>
                <span className="block text-canvas/50">Settling</span>
                <span className="tnum mt-0.5 block font-semibold">€40.00</span>
              </span>
            </div>
          </div>

          <ul className="mt-3 grid grid-cols-4 gap-1.5">
            {(["scan", "send", "receive", "plus"] as const).map((name, i) => {
              const I = Icon[name];
              return (
                <li key={name} className="rounded-xl border border-hair bg-surface py-2.5 text-center">
                  <I className="mx-auto h-4 w-4" />
                  <span className="mt-1 block text-[9.5px] text-muted">{["Pay", "Send", "Receive", "Add"][i]}</span>
                </li>
              );
            })}
          </ul>

          <ul className="mt-3 divide-y divide-hair rounded-card border border-hair bg-surface">
            {[
              ["Blue Bottle Coffee", "Today 09:12", "−4.20", false],
              ["From Marta", "Yesterday", "+35.00", true],
              ["Deposit · Base", "12 Sept", "+500.00", true],
            ].map(([who, when, amount, incoming]) => (
              <li key={who as string} className="flex items-center gap-3 px-3.5 py-2.5">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full ${
                    incoming ? "bg-positive-soft text-positive" : "bg-shell text-ink"
                  }`}
                >
                  <Icon.store className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11.5px] font-medium">{who as string}</span>
                  <span className="block text-[10px] text-muted">{when as string}</span>
                </span>
                <span className={`tnum text-[11.5px] font-semibold ${incoming ? "text-positive" : ""}`}>
                  {amount as string}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex items-center justify-around border-t border-hair px-2 pb-4 pt-2.5">
          {(["home", "wallet", "scan", "list", "settings"] as const).map((name, i) => {
            const I = Icon[name];
            const primary = i === 2;
            return primary ? (
              <span key={name} className="-mt-5 flex h-11 w-11 items-center justify-center rounded-full bg-coral text-white">
                <I className="h-5 w-5" />
              </span>
            ) : (
              <I key={name} className={`h-[18px] w-[18px] ${i === 0 ? "text-ink" : "text-muted"}`} />
            );
          })}
        </div>
      </div>
    </div>
  );
}
