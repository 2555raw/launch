import { PublicShell } from "@/components/PublicShell";
import { GetUsdgGuide } from "@/components/wallet/GetUsdgGuide";

export const metadata = {
  title: "Get USDG",
  description: "How to get a little USDG on Robinhood Chain to join Stepit, from the Robinhood app or by bridging USDC.",
};

export default function GetUsdgPage() {
  return (
    <PublicShell>
      <GetUsdgGuide />
    </PublicShell>
  );
}
