import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icons";

/** Every app page opens the same way: a back affordance on mobile, a title, an optional action. */
export function PageHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: string;
  subtitle?: string;
  back?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 px-5 pb-6 pt-6 md:px-1 md:pt-0">
      <div className="flex min-w-0 items-start gap-3">
        {back && (
          <Link
            href={back}
            aria-label="Back"
            className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-shell md:hidden"
          >
            <Icon.back className="h-5 w-5" />
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-[26px] font-extrabold tracking-[-0.035em] md:text-[32px]">{title}</h1>
          {subtitle && <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0 pt-1">{action}</div>}
    </header>
  );
}
