"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./Button";
import { Spinner } from "./States";
import type { ReactNode } from "react";

/**
 * A submit button that disables itself while the action is in flight. This is
 * also the first line of defence against a double-spend from a double-click;
 * the second is the idempotency key the action carries.
 */
export function Submit({
  children,
  pendingLabel,
  variant = "primary",
  size = "lg",
  full = true,
  disabled,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  full?: boolean;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} full={full} disabled={pending || disabled}>
      {pending ? (
        <>
          <Spinner /> {pendingLabel ?? "Working"}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
