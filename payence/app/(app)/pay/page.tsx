import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth/guard";
import { PageHeader } from "@/components/app/PageHeader";
import { Scanner } from "./Scanner";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icons";

export const metadata: Metadata = { title: "Pay · Payence" };

export default function PayPage() {
  requireAuth();
  return (
    <div>
      <PageHeader title="Pay" subtitle="Scan a merchant code, or enter it by hand." back="/dashboard" />
      <div className="space-y-5 px-5 md:px-1">
        <Scanner />
        <section className="card px-5 py-5">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <Icon.phone className="h-4 w-4 text-muted" />
            Contactless
          </h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            Tap-to-pay at a card terminal needs a native app with access to the secure element, plus an issuing partner.
            It is not available in this web app.
          </p>
          <Button href="/developers#physical" variant="secondary" size="sm" className="mt-4">
            How in-store payments work
          </Button>
        </section>
      </div>
    </div>
  );
}
