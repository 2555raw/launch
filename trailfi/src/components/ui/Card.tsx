import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass rounded-3xl", className)} {...rest} />;
}

export function CardHeader({ title, label, action, className }: { title?: ReactNode; label?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div>
        {label && <div className="label mb-1.5">{label}</div>}
        {title && <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>}
      </div>
      {action}
    </div>
  );
}
