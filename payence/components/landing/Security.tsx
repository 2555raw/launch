import { Icon, type IconName } from "@/components/ui/Icons";

const ITEMS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "lock",
    title: "Keys you never have to hold",
    body: "There is no seed phrase to lose. Balances are held by the platform and moved by signed, audited operations rather than by a key sitting in your browser.",
  },
  {
    icon: "shield",
    title: "Two-factor by app",
    body: "A time-based code from your authenticator, checked at sign-in. Turning it off asks for your password, not just an open session.",
  },
  {
    icon: "clock",
    title: "Limits that are yours to set",
    body: "Each level has a ceiling per payment, per day and per month. You can set a lower one for yourself at any time.",
  },
  {
    icon: "list",
    title: "An audit trail on every action",
    body: "Sign-ins, failed attempts, key changes and every movement of value are written to an append-only log.",
  },
];

export function Security() {
  return (
    <section id="security" className="border-b border-hair bg-shell py-20 md:py-28">
      <div className="shell">
        <h2 className="max-w-[18ch] text-title font-extrabold">Built the way a payments system has to be.</h2>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2">
          {ITEMS.map((i) => {
            const I = Icon[i.icon];
            return (
              <li key={i.title} className="rounded-card border border-hair bg-surface px-6 py-6">
                <I className="h-5 w-5 text-ink" />
                <h3 className="mt-4 text-[17px] font-bold tracking-tight">{i.title}</h3>
                <p className="mt-2 text-[14px] leading-[1.65] text-muted">{i.body}</p>
              </li>
            );
          })}
        </ul>
        <p className="mt-8 max-w-[64ch] text-[13px] leading-relaxed text-muted">
          Identity verification, sanctions screening and transaction monitoring are carried out by licensed providers.
          This build has the integration points and the internal rules in place; no vendor is connected, so nothing here
          should be read as a compliance claim.
        </p>
      </div>
    </section>
  );
}
