"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { site } from "@/lib/site";

const KEY = "picker.disclosure.v1";
/** Where a visitor who denies the disclosure is sent. */
export const DENY_URL = "https://www.ponsfamily.com/launchpad";

/**
 * Risk disclosure shown on a visitor's first entry. Accepting is remembered
 * in this browser; denying leaves the site for the Pons launchpad.
 */
export function DisclosureGate() {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let accepted = false;
    try {
      accepted = localStorage.getItem(KEY) === "accepted";
    } catch {
      /* storage unavailable: ask every visit */
    }
    if (!accepted) setOpen(true);
  }, []);

  function accept() {
    try {
      localStorage.setItem(KEY, "accepted");
    } catch {
      /* storage unavailable */
    }
    setOpen(false);
  }

  function deny() {
    setLeaving(true);
    window.location.assign(DENY_URL);
  }

  const points = [
    `${site.name} is an independent interface. It is not affiliated with Pons, Pump.fun, StonkFun, Four.meme, Flap, Argus or any chain it lists.`,
    "Tokens launched on these pads are highly speculative and can lose all of their value. Nothing here is financial, legal or tax advice.",
    "Transactions are signed by your own agent or wallet and may be irreversible. We never hold your funds or keys.",
    "You are responsible for complying with the laws where you live, and you confirm you are not a resident of a sanctioned or restricted jurisdiction.",
  ];

  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-md" />
        <Dialog.Content
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="fixed left-1/2 top-1/2 z-[91] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-line-strong bg-[#25262b] p-6 shadow-2xl shadow-black/70 sm:p-8"
        >
          <span className="grid size-11 place-items-center rounded-2xl bg-surface-3 text-bone">
            <ShieldAlert className="size-5" aria-hidden="true" />
          </span>
          <Dialog.Title className="display mt-5 text-2xl font-semibold">Before you enter</Dialog.Title>
          <Dialog.Description className="mt-2 text-[15px] text-fog">
            Please read and accept this disclosure to use {site.name}.
          </Dialog.Description>

          <ul className="mt-5 space-y-3 rounded-2xl border border-line bg-ink-2 p-4 text-sm leading-relaxed text-fog">
            {points.map((p) => (
              <li key={p.slice(0, 20)} className="flex gap-3">
                <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-bone/70" />
                {p}
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs text-mute">
            By accepting you agree to the{" "}
            <Link href="/legal/terms" className="text-fog underline underline-offset-2 hover:text-bone" onClick={accept}>
              Terms
            </Link>
            ,{" "}
            <Link href="/legal/privacy" className="text-fog underline underline-offset-2 hover:text-bone" onClick={accept}>
              Privacy
            </Link>{" "}
            and{" "}
            <Link href="/legal/disclosures" className="text-fog underline underline-offset-2 hover:text-bone" onClick={accept}>
              Disclosures
            </Link>
            .
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button type="button" onClick={deny} disabled={leaving} className="btn btn-ghost btn-lg">
              {leaving ? "Leaving…" : "Deny"}
            </button>
            <button type="button" onClick={accept} disabled={leaving} autoFocus className="btn btn-primary btn-lg">
              Accept
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
