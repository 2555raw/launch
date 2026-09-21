import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentAuth } from "@/lib/auth/session";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Create an account · Payence" };

export default function SignupPage({ searchParams }: { searchParams: { next?: string } }) {
  if (currentAuth()) redirect("/dashboard");
  return (
    <div>
      <h1 className="text-[30px] font-extrabold tracking-[-0.035em]">Create your account</h1>
      <p className="mt-2 text-[14.5px] text-muted">
        Hold stablecoins, pay anywhere Payence is accepted. No crypto experience needed.
      </p>
      <div className="mt-8">
        <SignupForm next={searchParams.next} />
      </div>
      <p className="mt-8 text-center text-[14px] text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}
