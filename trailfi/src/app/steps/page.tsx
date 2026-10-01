import { AppShell } from "@/components/AppShell";
import { StepsUploadView } from "@/components/steps/StepsUploadView";
import { AuthGate } from "@/components/wallet/AuthGate";

export const metadata = { title: "Upload steps" };

export default function StepsPage() {
  return (
    <AppShell>
      <AuthGate>
        <StepsUploadView />
      </AuthGate>
    </AppShell>
  );
}
