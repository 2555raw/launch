import { Button } from "@/components/ui/Button";

export function FinalCta() {
  return (
    <section className="py-20 md:py-28">
      <div className="shell">
        <div className="rounded-sheet border border-hair bg-surface px-6 py-14 text-center shadow-card md:px-16 md:py-20">
          <h2 className="mx-auto max-w-[16ch] text-title font-extrabold">Money that moves at the speed of a message.</h2>
          <p className="mx-auto mt-5 max-w-[46ch] text-[16px] leading-relaxed text-muted">
            Open an account in under a minute, or set up your business to take payments this afternoon.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button href="/signup" size="lg">
              Open an account
            </Button>
            <Button href="/merchant" variant="secondary" size="lg">
              Accept payments
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
