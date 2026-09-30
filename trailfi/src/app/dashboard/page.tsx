import { AppShell } from "@/components/AppShell";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { AuthGate } from "@/components/wallet/AuthGate";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <AppShell>
      <AuthGate>
        <DashboardView />
      </AuthGate>
    </AppShell>
  );
}
