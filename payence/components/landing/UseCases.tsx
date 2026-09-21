import { Icon, type IconName } from "@/components/ui/Icons";

const CASES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "store",
    title: "In a shop",
    body: "Scan the code at the till, confirm, walk out. No terminal, no card, no PIN pad, and the merchant has the money before you have left the counter.",
  },
  {
    icon: "globe",
    title: "Online",
    body: "A checkout that looks like any other checkout. One tap from a balance you already hold, with no card number to type and nothing for the shop to store.",
  },
  {
    icon: "send",
    title: "To another person",
    body: "Send to a handle. It arrives instantly and it is free, whether they are in the next room or another country.",
  },
  {
    icon: "bolt",
    title: "Across borders",
    body: "A payment to another country is the same payment as one across town: same speed, same cost. There is no correspondent bank in the middle.",
  },
];

export function UseCases() {
  return (
    <section className="border-b border-hair py-20 md:py-28">
      <div className="shell">
        <h2 className="max-w-[18ch] text-title font-extrabold">The same balance, wherever you are paying.</h2>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2">
          {CASES.map((c) => {
            const I = Icon[c.icon];
            return (
              <li key={c.title} className="card px-6 py-6">
                <I className="h-5 w-5 text-coral" />
                <h3 className="mt-4 text-[18px] font-bold tracking-tight">{c.title}</h3>
                <p className="mt-2 text-[14px] leading-[1.65] text-muted">{c.body}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
