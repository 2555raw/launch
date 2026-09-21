import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentAuth } from "@/lib/auth/session";
import { VerifyForm } from "./VerifyForm";

export const metadata: Metadata = { title: "Two-factor · Payence" };

export default function VerifyPage() {
  const auth = currentAuth();
  if (!auth) redirect("/login");
  if (auth.session.mfaPassed) redirect("/dashboard");
  return (
    <div>
      <h1 className="text-[30px] font-extrabold tracking-[-0.035em]">Two-factor code</h1>
      <p className="mt-2 text-[14.5px] text-muted">
        Open your authenticator app and enter the six digits it shows for Payence.
      </p>
      <div className="mt-8">
        <VerifyForm />
      </div>
    </div>
  );
}
