"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/fetcher";
import type { Payout } from "./hooks";

/** Creates (prepares) a payout record for a user; the modal then handles sending. */
export function usePreparePayout(onPrepared: (p: Payout) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api<{ payout: Payout }>("/api/admin/payouts", { method: "POST", json: { userId } }),
    onSuccess: async ({ payout }) => {
      await qc.invalidateQueries({ queryKey: ["admin"] });
      onPrepared(payout);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
