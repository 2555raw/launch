"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { EmptyState, Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/fetcher";
import { fmtDateTime, shortAddress } from "@/lib/format";
import { PageHeader } from "./PageHeader";

interface Entry {
  id: string;
  actor: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export function AuditView() {
  const { data, isLoading } = useQuery({ queryKey: ["admin", "audit"], queryFn: () => api<{ entries: Entry[] }>("/api/admin/audit") });
  return (
    <div>
      <PageHeader label="Audit log" title="Every sensitive action" description="Logins, reviews, distributions, settings changes and payouts, with the wallet that performed them." />
      <Card className="overflow-hidden">
        {isLoading && <Skeleton className="m-6 h-40" />}
        {data && data.entries.length === 0 && (
          <div className="p-6">
            <EmptyState title="Nothing logged yet" />
          </div>
        )}
        <ul className="divide-y divide-white/5">
          {data?.entries.map((e) => (
            <li key={e.id} className="flex flex-col gap-1 px-6 py-3.5 sm:flex-row sm:items-center sm:gap-6">
              <span className="w-36 shrink-0 text-[12px] text-white/40">{fmtDateTime(e.createdAt)}</span>
              <span className="w-40 shrink-0 font-mono text-[12.5px] text-lime-300">{e.action}</span>
              <span className="w-36 shrink-0 font-mono text-[12px] text-white/60">{e.actor.startsWith("0x") ? shortAddress(e.actor) : e.actor}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-white/35" title={JSON.stringify(e.details)}>
                {e.entity && `${e.entity}${e.entityId ? `:${e.entityId.slice(0, 8)}` : ""} `}
                {JSON.stringify(e.details)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
