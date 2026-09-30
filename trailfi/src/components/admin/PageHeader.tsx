import type { ReactNode } from "react";

export function PageHeader({ label, title, description, action }: { label: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <div className="label !text-lime-300/80">{label}</div>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-white/55">{description}</p>}
      </div>
      {action}
    </div>
  );
}
