import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentAuth } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in · Payence" };

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  if (currentAuth()) redirect("/dashboard");
  return (
    <div>
      <h1 className="text-[30px] font-extrabold tracking-[-0.035em]">Welcome back</h1>
      <p className="mt-2 text-[14.5px] text-muted">Sign in to your Payence account.</p>
      <div className="mt-8">
        <LoginForm next={searchParams.next} />
      </div>
      <p className="mt-8 text-center text-[14px] text-muted">
        No account yet?{" "}
        <Link href="/signup" className="font-medium text-ink underline underline-offset-4">
          Create one
        </Link>
      </p>
    </div>
  );
}
