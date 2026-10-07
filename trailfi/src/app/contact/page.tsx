import { Mail, MessageCircle } from "lucide-react";
import { InfoPage, Section } from "@/components/info/InfoPage";
import { XLogo } from "@/components/ui/XLogo";
import { X_HANDLE, X_URL } from "@/lib/social";

export const metadata = { title: "Contact" };

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "helloStepIT@outlook.com";
const SECURITY = process.env.NEXT_PUBLIC_SECURITY_EMAIL || CONTACT;

export default function ContactPage() {
  return (
    <InfoPage label="Contact" title="Talk to the Stepit team" intro="Partnerships, press, support or security reports. Email us or find us on X.">
      <div className="grid gap-4 sm:grid-cols-2">
        <a href={`mailto:${CONTACT}`} className="glass group rounded-3xl p-6 transition hover:border-lime-400/40">
          <Mail className="h-6 w-6 text-lime-400" />
          <div className="mt-4 font-display text-lg font-semibold">{CONTACT}</div>
          <p className="mt-1 text-sm text-white/55">Support, partnerships and press</p>
        </a>
        <a
          href={`mailto:${SECURITY}?subject=${encodeURIComponent("Security report")}`}
          className="glass group rounded-3xl p-6 transition hover:border-lime-400/40"
        >
          <MessageCircle className="h-6 w-6 text-lime-400" />
          <div className="mt-4 font-display text-lg font-semibold">Report a security issue</div>
          <p className="mt-1 text-sm text-white/55">
            Write to {SECURITY} with the subject &quot;Security report&quot;. We reply to every responsible disclosure.
          </p>
        </a>
        <a
          href={X_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="glass group flex items-center gap-4 rounded-3xl p-6 transition hover:border-lime-400/40 sm:col-span-2"
        >
          <XLogo className="h-6 w-6 shrink-0 text-lime-400" />
          <div className="min-w-0 flex-1">
            <div className="font-display text-lg font-semibold">@{X_HANDLE}</div>
            <p className="mt-1 text-sm text-white/55">Follow us on X for news and launch updates. You can also DM us there.</p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-lime-300 transition group-hover:translate-x-0.5">Follow</span>
        </a>
      </div>
      <Section title="Support">
        <p>Stepit staff will never DM you first and will never ask for your seed phrase or private key. Anyone who does is a scammer.</p>
      </Section>
    </InfoPage>
  );
}
