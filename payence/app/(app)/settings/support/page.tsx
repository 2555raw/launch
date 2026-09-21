import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth/guard";
import { PageHeader } from "@/components/app/PageHeader";
import { Alert } from "@/components/ui/Alert";

export const metadata: Metadata = { title: "Support · Payence" };

export default function SupportPage() {
  const { user } = requireAuth();
  return (
    <div>
      <PageHeader title="Support" back="/settings" />
      <div className="space-y-5 px-5 md:px-1">
        <Alert tone="info" title="No support desk is connected here.">
          A production deployment routes this to a helpdesk with access to the audit log and the transaction record.
          Until then, nothing sent from this page reaches anyone.
        </Alert>
        <section className="card px-5 py-5 text-[13.5px] leading-relaxed text-muted">
          <h2 className="text-[15px] font-semibold text-ink">What to have ready</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>The transaction ID from the receipt, which starts with <code className="font-mono text-[12.5px]">txn_</code>.</li>
            <li>The date and the amount, and who the other side was.</li>
            <li>For an on-chain transfer, the network and the transaction hash.</li>
          </ul>
          <h2 className="mt-6 text-[15px] font-semibold text-ink">What cannot be undone</h2>
          <p className="mt-2">
            A confirmed blockchain withdrawal cannot be reversed by Payence or by anyone else. A payment to a Payence
            merchant can be refunded by that merchant. A transfer to another Payence account can only be returned by
            the person who received it.
          </p>
          <p className="mt-6 text-[12.5px]">Signed in as {user.email}.</p>
        </section>
      </div>
    </div>
  );
}
