"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icons";
import { ASSETS, ASSET_IDS } from "@/lib/assets";

/**
 * The product in the hero, running.
 *
 * It is an iPhone frame around a working miniature of the app: the tab bar
 * switches screens, the quick actions open their flows, a transaction opens its
 * receipt, and the pay flow runs scan, confirm, done. A still image of a wallet
 * proves nothing; letting someone tap through a payment in three seconds is the
 * whole pitch. The data is fixed sample data and the screen says so on the
 * receipt, so nothing here is passed off as a real balance.
 */

type Screen =
  | "home"
  | "wallet"
  | "activity"
  | "settings"
  | "pay"
  | "confirm"
  | "paid"
  | "receive"
  | "send"
  | "add"
  | "tx";

type Tx = {
  id: string;
  who: string;
  when: string;
  amount: string;
  asset: string;
  fiat: string;
  incoming: boolean;
  icon: IconName;
  network?: string;
  hash?: string;
  fee: string;
};

const TXS: Tx[] = [
  {
    id: "txn_9f3c21",
    who: "Blue Bottle Coffee",
    when: "Today 09:12",
    amount: "−4.20",
    asset: "4.57 USDC",
    fiat: "€4.20",
    incoming: false,
    icon: "store",
    fee: "Free",
  },
  {
    id: "txn_7b1d08",
    who: "From Marta",
    when: "Yesterday 19:40",
    amount: "+35.00",
    asset: "38.04 USDC",
    fiat: "€35.00",
    incoming: true,
    icon: "send",
    fee: "Free",
  },
  {
    id: "txn_4a90cc",
    who: "Deposit · Base",
    when: "12 Sept 11:03",
    amount: "+500.00",
    asset: "543.47 USDC",
    fiat: "€500.00",
    incoming: true,
    icon: "plus",
    network: "Base",
    hash: "0x8f2a…c41d",
    fee: "Free",
  },
];

const HOLDINGS = [
  { asset: "USDC", amount: "2,010.44", fiat: "€1,850.20" },
  { asset: "EURC", amount: "150.00", fiat: "€150.00" },
  { asset: "USDT", amount: "489.28", fiat: "€450.12" },
];

const TABS: { screen: Screen; icon: IconName; label: string }[] = [
  { screen: "home", icon: "home", label: "Home" },
  { screen: "wallet", icon: "wallet", label: "Wallet" },
  { screen: "pay", icon: "scan", label: "Pay" },
  { screen: "activity", icon: "list", label: "Activity" },
  { screen: "settings", icon: "settings", label: "Settings" },
];

/** A deterministic QR-like matrix: a picture of a code, drawn rather than encoded. */
const QR = (() => {
  const size = 21;
  const cells: boolean[][] = [];
  let seed = 20260921;
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let y = 0; y < size; y++) {
    cells[y] = [];
    for (let x = 0; x < size; x++) cells[y][x] = next() > 0.52;
  }
  // The three finder squares, so it reads as a code and not as noise.
  const finder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 7; x++) {
        const edge = x === 0 || y === 0 || x === 6 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        cells[oy + y][ox + x] = edge || core;
      }
  };
  finder(0, 0);
  finder(size - 7, 0);
  finder(0, size - 7);
  return cells;
})();

export function PhoneMock() {
  const [stack, setStack] = useState<Screen[]>(["home"]);
  const [tx, setTx] = useState<Tx>(TXS[0]);
  const screen = stack[stack.length - 1];

  const push = (s: Screen) => setStack((v) => [...v, s]);
  const back = () => setStack((v) => (v.length > 1 ? v.slice(0, -1) : v));
  const tab = (s: Screen) => setStack([s]);
  const openTx = (t: Tx) => {
    setTx(t);
    push("tx");
  };

  const activeTab: Screen = ["home", "wallet", "pay", "activity", "settings"].includes(stack[0])
    ? stack[0]
    : "home";

  return (
    <div className="flex flex-col items-center gap-4">
      <div data-phone className="relative w-[288px] shrink-0 sm:w-[316px]">
        {/* The side buttons, drawn on the titanium rail rather than implied. */}
        <span aria-hidden className="absolute -left-[3px] top-[104px] h-8 w-[3px] rounded-l bg-[#2b2b2e]" />
        <span aria-hidden className="absolute -left-[3px] top-[152px] h-14 w-[3px] rounded-l bg-[#2b2b2e]" />
        <span aria-hidden className="absolute -left-[3px] top-[220px] h-14 w-[3px] rounded-l bg-[#2b2b2e]" />
        <span aria-hidden className="absolute -right-[3px] top-[186px] h-20 w-[3px] rounded-r bg-[#2b2b2e]" />

        {/* Titanium band, then the black bezel, then the screen. */}
        <div className="rounded-[14.5%] bg-gradient-to-b from-[#5b5b60] via-[#2a2a2d] to-[#4a4a4f] p-[3px] shadow-float">
          <div className="relative overflow-hidden rounded-[14%] bg-black p-[9px]">
            <div className="relative aspect-[393/852] overflow-hidden rounded-[11%] bg-canvas">
              {/* Dynamic Island */}
              <span
                aria-hidden
                className="absolute left-1/2 top-[11px] z-30 h-[26px] w-[88px] -translate-x-1/2 rounded-full bg-black"
              />

              <StatusBar />

              <div className="absolute inset-x-0 bottom-[58px] top-[46px] overflow-y-auto overscroll-contain">
                {screen === "home" && <Home onAction={push} onTx={openTx} />}
                {screen === "wallet" && <Wallet onAction={push} />}
                {screen === "activity" && <Activity onTx={openTx} />}
                {screen === "settings" && <Settings />}
                {screen === "pay" && <Pay onScan={() => push("confirm")} />}
                {screen === "confirm" && <Confirm onPay={() => push("paid")} onBack={back} />}
                {screen === "paid" && <Paid onDone={() => tab("home")} />}
                {screen === "receive" && <Receive onBack={back} />}
                {screen === "send" && <Send onBack={back} onSent={() => push("paid")} />}
                {screen === "add" && <AddMoney onBack={back} />}
                {screen === "tx" && <TxDetail tx={tx} onBack={back} />}
              </div>

              <TabBar active={activeTab} onTab={tab} />

              {/* Home indicator */}
              <span
                aria-hidden
                className="absolute bottom-[6px] left-1/2 z-30 h-[4px] w-[112px] -translate-x-1/2 rounded-full bg-ink/35"
              />
            </div>
          </div>
        </div>
      </div>

      <p className="text-[12.5px] text-muted">
        This one is live. Tap around it.
      </p>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="absolute inset-x-0 top-0 z-20 flex h-[46px] items-center justify-between px-6 pt-1 text-[11px] font-semibold text-ink">
      <span className="tnum">9:41</span>
      <span className="flex items-center gap-1.5" aria-hidden>
        {/* signal */}
        <svg viewBox="0 0 18 12" className="h-[11px] w-[17px]" fill="currentColor">
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
          <rect x="10" y="3" width="3" height="9" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" opacity="0.35" />
        </svg>
        {/* wifi */}
        <svg viewBox="0 0 16 12" className="h-[11px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M1 4.2a10 10 0 0 1 14 0M3.6 7a6.4 6.4 0 0 1 8.8 0" />
          <circle cx="8" cy="9.8" r="1" fill="currentColor" stroke="none" />
        </svg>
        {/* battery */}
        <svg viewBox="0 0 26 12" className="h-[11px] w-[24px]" fill="none">
          <rect x="0.5" y="0.5" width="21" height="11" rx="3.2" stroke="currentColor" strokeOpacity="0.4" />
          <rect x="2" y="2" width="16" height="8" rx="2" fill="currentColor" />
          <path d="M23.5 4.3v3.4a2 2 0 0 0 0-3.4" fill="currentColor" fillOpacity="0.4" />
        </svg>
      </span>
    </div>
  );
}

function TabBar({ active, onTab }: { active: Screen; onTab: (s: Screen) => void }) {
  return (
    <nav
      aria-label="Demo navigation"
      className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-around border-t border-hair bg-surface/95 px-2 pb-[14px] pt-2 backdrop-blur"
    >
      {TABS.map((t) => {
        const I = Icon[t.icon];
        const on = active === t.screen;
        if (t.screen === "pay") {
          return (
            <button
              key={t.screen}
              type="button"
              onClick={() => onTab("pay")}
              aria-label="Pay"
              aria-current={on ? "page" : undefined}
              className="-mt-6 flex h-[46px] w-[46px] items-center justify-center rounded-full bg-coral text-white shadow-float transition-transform active:scale-95"
            >
              <I className="h-5 w-5" />
            </button>
          );
        }
        return (
          <button
            key={t.screen}
            type="button"
            onClick={() => onTab(t.screen)}
            aria-label={t.label}
            aria-current={on ? "page" : undefined}
            className={`flex h-9 w-11 items-center justify-center rounded-lg transition-colors ${
              on ? "text-ink" : "text-faint"
            }`}
          >
            <I className="h-[19px] w-[19px]" />
          </button>
        );
      })}
    </nav>
  );
}

/** Every screen below the tab bar shares this header shape. */
function Head({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <div className="flex items-center gap-1.5 px-4 pb-2 pt-1">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="-ml-1.5 flex h-7 w-7 items-center justify-center rounded-full text-ink transition-colors active:bg-shell"
        >
          <Icon.back className="h-4 w-4" />
        </button>
      )}
      <p className="text-[17px] font-bold tracking-tight">{title}</p>
    </div>
  );
}

function Home({ onAction, onTx }: { onAction: (s: Screen) => void; onTx: (t: Tx) => void }) {
  return (
    <div className="px-3.5 pt-1">
      <div className="rounded-card bg-ink px-4 py-4 text-canvas">
        <p className="text-[10px] uppercase tracking-[0.1em] text-canvas/50">Total balance</p>
        <p className="tnum mt-1 text-[30px] font-extrabold tracking-[-0.035em]">€2,450.32</p>
        <div className="mt-3 flex gap-6 border-t border-hairDark pt-2.5 text-[11px]">
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

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {([
          ["pay", "scan", "Pay"],
          ["send", "send", "Send"],
          ["receive", "receive", "Receive"],
          ["add", "plus", "Add"],
        ] as [Screen, IconName, string][]).map(([s, icon, label]) => {
          const I = Icon[icon];
          return (
            <button
              key={label}
              type="button"
              onClick={() => onAction(s)}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-hair bg-surface py-2.5 transition-colors active:bg-shell"
            >
              <I className="h-[17px] w-[17px]" />
              <span className="text-[9.5px] font-medium text-muted">{label}</span>
            </button>
          );
        })}
      </div>

      <ul className="mt-3 divide-y divide-hair overflow-hidden rounded-card border border-hair bg-surface">
        {TXS.map((t) => (
          <li key={t.id}>
            <Row tx={t} onClick={() => onTx(t)} />
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onAction("receive")}
        className="mt-3 flex w-full items-center gap-2.5 rounded-card border border-hair bg-surface px-3 py-3 text-left transition-colors active:bg-shell"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-coral-soft text-coral">
          <Icon.receive className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11.5px] font-medium">Get paid</span>
          <span className="block text-[10px] text-muted">Show your code to receive money</span>
        </span>
        <Icon.chevron className="h-3 w-3 shrink-0 text-faint" />
      </button>
    </div>
  );
}

function Row({ tx, onClick }: { tx: Tx; onClick: () => void }) {
  const I = Icon[tx.icon];
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors active:bg-shell"
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          tx.incoming ? "bg-positive-soft text-positive" : "bg-shell text-ink"
        }`}
      >
        <I className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11.5px] font-medium">{tx.who}</span>
        <span className="block text-[10px] text-muted">{tx.when}</span>
      </span>
      <span className={`tnum shrink-0 text-[11.5px] font-semibold ${tx.incoming ? "text-positive" : ""}`}>
        {tx.amount}
      </span>
    </button>
  );
}

function Wallet({ onAction }: { onAction: (s: Screen) => void }) {
  return (
    <div className="px-3.5 pt-1">
      <Head title="Wallet" />
      <div className="rounded-card border border-hair bg-surface px-4 py-4">
        <p className="text-[10px] uppercase tracking-[0.1em] text-muted">Total</p>
        <p className="tnum mt-1 text-[26px] font-extrabold tracking-[-0.03em]">€2,450.32</p>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {([
            ["add", "plus", "Add"],
            ["send", "minus", "Withdraw"],
            ["wallet", "swap", "Convert"],
          ] as [Screen, IconName, string][]).map(([s, icon, label]) => {
            const I = Icon[icon];
            return (
              <button
                key={label}
                type="button"
                onClick={() => onAction(s)}
                className="flex flex-col items-center gap-1 rounded-lg border border-hair py-2 text-[9.5px] font-medium transition-colors active:bg-shell"
              >
                <I className="h-[15px] w-[15px]" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <ul className="mt-3 divide-y divide-hair overflow-hidden rounded-card border border-hair bg-surface">
        {HOLDINGS.map((h) => {
          const meta = ASSETS[h.asset as (typeof ASSET_IDS)[number]];
          return (
            <li key={h.asset} className="flex items-center gap-2.5 px-3 py-2.5">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[8.5px] font-bold text-white"
                style={{ backgroundColor: meta.colour }}
              >
                {meta.symbol.slice(0, 2)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11.5px] font-medium">{meta.name}</span>
                <span className="block text-[10px] text-muted">{meta.symbol}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="tnum block text-[11.5px] font-semibold">{h.amount}</span>
                <span className="tnum block text-[10px] text-muted">{h.fiat}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Activity({ onTx }: { onTx: (t: Tx) => void }) {
  return (
    <div className="px-3.5 pt-1">
      <Head title="Activity" />
      <ul className="divide-y divide-hair overflow-hidden rounded-card border border-hair bg-surface">
        {[...TXS, ...TXS].map((t, i) => (
          <li key={`${t.id}-${i}`}>
            <Row tx={t} onClick={() => onTx(t)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Settings() {
  const rows: [IconName, string, string][] = [
    ["shield", "Security", "Two-factor is on"],
    ["user", "Identity", "Verified · higher limits"],
    ["bell", "Notifications", "3 unread"],
    ["store", "Merchant", "Accept payments"],
  ];
  return (
    <div className="px-3.5 pt-1">
      <Head title="Settings" />
      <div className="flex items-center gap-2.5 rounded-card border border-hair bg-surface px-3 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-canvas">
          AM
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[12.5px] font-semibold">Alex Moreau</span>
          <span className="block truncate text-[10px] text-muted">@alex</span>
        </span>
      </div>
      <ul className="mt-3 divide-y divide-hair overflow-hidden rounded-card border border-hair bg-surface">
        {rows.map(([icon, title, sub]) => {
          const I = Icon[icon];
          return (
            <li key={title} className="flex items-center gap-2.5 px-3 py-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-shell">
                <I className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11.5px] font-medium">{title}</span>
                <span className="block truncate text-[10px] text-muted">{sub}</span>
              </span>
              <Icon.chevron className="h-3 w-3 shrink-0 text-faint" />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Pay({ onScan }: { onScan: () => void }) {
  return (
    <div className="px-3.5 pt-1">
      <Head title="Pay" />
      <div className="overflow-hidden rounded-card border border-hair bg-ink">
        <div className="relative flex aspect-[4/3] items-center justify-center">
          <span aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,92,53,0.16),transparent_60%)]" />
          <span aria-hidden className="h-28 w-28 rounded-2xl border-2 border-canvas/70" />
          <span aria-hidden className="absolute h-28 w-28">
            <span className="absolute inset-x-0 top-1/2 h-px bg-coral" />
          </span>
        </div>
        <p className="px-4 py-2.5 text-center text-[10.5px] text-canvas/60">
          Point the camera at the merchant&apos;s code
        </p>
      </div>
      <button
        type="button"
        onClick={onScan}
        className="mt-3 h-11 w-full rounded-pill bg-ink text-[13px] font-medium text-canvas transition-transform active:scale-[0.98]"
      >
        Scan the code
      </button>
      <p className="mt-2 text-center text-[10px] text-muted">Demo: this stands in for the camera.</p>
    </div>
  );
}

function Confirm({ onPay, onBack }: { onPay: () => void; onBack: () => void }) {
  return (
    <div className="px-3.5 pt-1">
      <Head title="Confirm" onBack={onBack} />
      <div className="rounded-card border border-hair bg-surface px-4 py-5 text-center">
        <p className="text-[10px] uppercase tracking-[0.1em] text-muted">Paying</p>
        <p className="mt-1 text-[14px] font-bold tracking-tight">Blue Bottle Coffee</p>
        <p className="tnum mt-3 text-[30px] font-extrabold tracking-[-0.035em]">€4.20</p>
        <p className="mt-1 text-[10.5px] text-muted">Flat white</p>

        <dl className="mt-4 space-y-1.5 border-t border-hair pt-3 text-left text-[10.5px]">
          {[
            ["You pay", "4.57 USDC"],
            ["Rate", "1 USDC = 0.92 EUR"],
            ["Fee to you", "None"],
            ["Settles in", "About 2 seconds"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-muted">{k}</dt>
              <dd className="tnum font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <button
        type="button"
        onClick={onPay}
        className="mt-3 h-11 w-full rounded-pill bg-coral text-[13px] font-semibold text-white transition-transform active:scale-[0.98]"
      >
        Pay 4.57 USDC
      </button>
    </div>
  );
}

function Paid({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-positive-soft text-positive">
        <Icon.check className="h-7 w-7" />
      </span>
      <p className="mt-4 text-[16px] font-bold tracking-tight">Payment complete</p>
      <p className="mt-1 text-[11px] text-muted">Blue Bottle Coffee has been paid.</p>
      <p className="tnum mt-3 text-[24px] font-extrabold tracking-[-0.03em]">4.57 USDC</p>
      <button
        type="button"
        onClick={onDone}
        className="mt-6 h-10 rounded-pill border border-hairStrong px-5 text-[12.5px] font-medium transition-colors active:bg-shell"
      >
        Back to wallet
      </button>
    </div>
  );
}

function QrBlock() {
  return (
    <div className="mx-auto w-[128px] rounded-xl border border-hair bg-white p-2">
      <svg viewBox="0 0 21 21" className="block h-full w-full" role="img" aria-label="Payment code">
        <rect width="21" height="21" fill="#fff" />
        {QR.map((row, y) =>
          row.map((on, x) =>
            on ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#141414" /> : null
          )
        )}
      </svg>
    </div>
  );
}

function Receive({ onBack }: { onBack: () => void }) {
  return (
    <div className="px-3.5 pt-1">
      <Head title="Receive" onBack={onBack} />
      <div className="rounded-card border border-hair bg-surface px-4 py-5 text-center">
        <QrBlock />
        <p className="mt-3 text-[15px] font-bold tracking-tight">@alex</p>
        <p className="mt-0.5 text-[10.5px] text-muted">Alex Moreau</p>
        <p className="mt-3 text-[10px] leading-relaxed text-muted">
          Anyone on Payence can scan this to pay you. Free, and it arrives instantly.
        </p>
      </div>
    </div>
  );
}

function Send({ onBack, onSent }: { onBack: () => void; onSent: () => void }) {
  return (
    <div className="px-3.5 pt-1">
      <Head title="Send" onBack={onBack} />
      <div className="rounded-card border border-hair bg-surface px-4 py-4">
        <p className="text-[10px] uppercase tracking-[0.1em] text-muted">Amount</p>
        <p className="tnum mt-1 text-[28px] font-extrabold tracking-[-0.035em]">
          25.00 <span className="text-[14px] font-semibold text-muted">USDC</span>
        </p>
        <div className="mt-3 flex items-center gap-2.5 border-t border-hair pt-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[9px] font-semibold text-canvas">
            MR
          </span>
          <span className="min-w-0">
            <span className="block text-[11.5px] font-medium">Marta Ruiz</span>
            <span className="block text-[10px] text-muted">@marta</span>
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onSent}
        className="mt-3 h-11 w-full rounded-pill bg-ink text-[13px] font-medium text-canvas transition-transform active:scale-[0.98]"
      >
        Send 25.00 USDC
      </button>
      <p className="mt-2 text-center text-[10px] text-muted">No fee between Payence accounts.</p>
    </div>
  );
}

function AddMoney({ onBack }: { onBack: () => void }) {
  return (
    <div className="px-3.5 pt-1">
      <Head title="Add money" onBack={onBack} />
      <div className="rounded-xl border border-warning/25 bg-warning-soft px-3 py-2.5 text-[10px] leading-relaxed text-warning">
        <strong className="font-semibold">Send only USDC or EURC on Base.</strong> Anything else sent here is lost.
      </div>
      <div className="mt-3 rounded-card border border-hair bg-surface px-4 py-4 text-center">
        <QrBlock />
        <p className="mt-3 break-all font-mono text-[9.5px] leading-relaxed">
          0x7a3f9c21b8e4d05a6f3c1b9e2d84a7c50f1b6e93
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-hair pt-3 text-left text-[10px]">
          <div>
            <dt className="text-muted">Network</dt>
            <dd className="mt-0.5 font-medium">Base</dd>
          </div>
          <div>
            <dt className="text-muted">Credited after</dt>
            <dd className="mt-0.5 font-medium">2 blocks (~8s)</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function TxDetail({ tx, onBack }: { tx: Tx; onBack: () => void }) {
  return (
    <div className="px-3.5 pt-1">
      <Head title="Receipt" onBack={onBack} />
      <div className="rounded-card border border-hair bg-surface px-4 py-4 text-center">
        <p className="text-[10.5px] text-muted">{tx.who}</p>
        <p className={`tnum mt-1 text-[26px] font-extrabold tracking-[-0.03em] ${tx.incoming ? "text-positive" : ""}`}>
          {tx.amount}
        </p>
        <p className="mt-1 text-[10.5px] text-muted">{tx.asset}</p>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-pill border border-positive/25 bg-positive-soft px-2.5 py-1 text-[9.5px] font-medium text-positive">
          <i className="h-1.5 w-1.5 rounded-full bg-current" />
          Completed
        </span>
      </div>

      <dl className="mt-3 divide-y divide-hair overflow-hidden rounded-card border border-hair bg-surface text-[10.5px]">
        {[
          ["Date", tx.when],
          ["Fiat value", tx.fiat],
          ["Fee", tx.fee],
          ...(tx.network ? [["Network", tx.network] as [string, string]] : []),
          ...(tx.hash ? [["Hash", tx.hash] as [string, string]] : []),
          ["Transaction", tx.id],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 px-3 py-2">
            <dt className="text-muted">{k}</dt>
            <dd className="truncate font-medium">{v}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-2.5 px-1 text-[9.5px] leading-relaxed text-muted">
        Sample data, shown so you can see the receipt a real payment produces.
      </p>
    </div>
  );
}
