import type { NotificationProvider } from "./types";
import { config } from "@/lib/config";
import { id } from "@/lib/ids";

/** Development sink: writes the email to the server log, delivers nothing. */
export class ConsoleEmail implements NotificationProvider {
  readonly name = "console";
  async send(input: { to: string; subject: string; text: string }) {
    console.info(`[email:console] to=${input.to} subject=${input.subject}\n${input.text}`);
    return { id: id("msg"), delivered: false };
  }
}

/** Resend, if a key is configured. Any transactional provider fits this shape. */
export class ResendEmail implements NotificationProvider {
  readonly name = "resend";
  async send(input: { to: string; subject: string; text: string }) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.email.resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: config.email.from, to: input.to, subject: input.subject, text: input.text }),
    });
    if (!res.ok) throw new Error(`Email delivery failed (${res.status})`);
    const json = (await res.json()) as { id: string };
    return { id: json.id, delivered: true };
  }
}

let cached: NotificationProvider | null = null;

export function email(): NotificationProvider {
  if (!cached) {
    cached = config.email.provider === "resend" && config.email.resendKey ? new ResendEmail() : new ConsoleEmail();
  }
  return cached;
}
