import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-[19px] font-extrabold tracking-[-0.045em]">PAYENCE</p>
      <h1 className="mt-8 text-[30px] font-extrabold tracking-[-0.035em] md:text-[38px]">
        This page does not exist.
      </h1>
      <p className="mt-4 max-w-[42ch] text-[15px] leading-relaxed text-muted">
        The link may be out of date, or the payment request behind it may have been removed. Nothing was charged.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button href="/dashboard" size="lg">
          Go to your wallet
        </Button>
        <Button href="/" variant="secondary" size="lg">
          Back to the homepage
        </Button>
      </div>
      <p className="mt-8 text-[13px] text-muted">
        <Link href="/settings/support" className="underline underline-offset-4 hover:text-ink">
          Get help with a payment
        </Link>
      </p>
    </main>
  );
}
