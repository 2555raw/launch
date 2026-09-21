import { redirect } from "next/navigation";
import { requireAuth, optionalMerchant } from "@/lib/auth/guard";

export default function MerchantIndex() {
  const { user } = requireAuth("/merchant");
  redirect(optionalMerchant(user.id) ? "/merchant/dashboard" : "/merchant/onboarding");
}
