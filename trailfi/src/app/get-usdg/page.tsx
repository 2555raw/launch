import { PublicShell } from "@/components/PublicShell";
import { GetUsdgGuide } from "@/components/wallet/GetUsdgGuide";

export const metadata = {
  title: "Get USDG",
  description: "How to get a little USDG on Robinhood Chain to cash out on Stepit, from the Robinhood app or by bridging USDC.",
};

export default function GetUsdgPage() {
  return (
    <PublicShell>
      <GetUsdgGuide />
    </PublicShell>
  );
}
