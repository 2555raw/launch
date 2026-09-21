import Link from "next/link";
import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth/guard";
import { listNotifications } from "@/lib/services/notifications";
import { markNotificationsReadAction } from "../actions";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/ui/States";
import { Icon, type IconName } from "@/components/ui/Icons";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Notifications · Payence" };

const KIND_ICON: Record<string, IconName> = {
  payment: "send",
  security: "shield",
  account: "user",
  merchant: "store",
};

export default function NotificationsPage() {
  const { user } = requireAuth();
  const items = listNotifications(user.id);
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        back="/settings"
        action={
          unread > 0 ? (
            <form action={markNotificationsReadAction}>
              <Button type="submit" variant="ghost" size="sm">
                Mark all read
              </Button>
            </form>
          ) : undefined
        }
      />
      <div className="px-5 md:px-1">
        <section className="card overflow-hidden">
          {items.length ? (
            <ul className="divide-y divide-hair">
              {items.map((n) => {
                const I = Icon[KIND_ICON[n.kind] ?? "bell"];
                const body = (
                  <div className={`flex gap-3.5 px-5 py-4 ${n.readAt ? "" : "bg-coral-soft/40"}`}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-shell text-ink">
                      <I className="h-[17px] w-[17px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14.5px] font-medium">{n.title}</p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{n.body}</p>
                      <p className="mt-1.5 text-[12px] text-faint">
                        {new Date(n.createdAt).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
                return <li key={n.id}>{n.href ? <Link href={n.href} className="block transition-colors hover:bg-shell/60">{body}</Link> : body}</li>;
              })}
            </ul>
          ) : (
            <EmptyState
              icon={<Icon.bell className="h-5 w-5" />}
              title="Nothing to catch up on"
              body="Payments received, security changes and account updates show up here."
            />
          )}
        </section>
        <p className="py-5 text-center text-[12.5px] leading-relaxed text-muted">
          Push and email delivery need a notification provider. Configure one in the environment and these also reach
          your inbox and your phone.
        </p>
      </div>
    </div>
  );
}
