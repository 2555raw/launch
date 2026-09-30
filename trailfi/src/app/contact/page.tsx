import { Mail, MessageCircle } from "lucide-react";
import { InfoPage, Section } from "@/components/info/InfoPage";

export const metadata = { title: "Contact" };

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@stepit.example";
const SECURITY = process.env.NEXT_PUBLIC_SECURITY_EMAIL || "security@stepit.example";

export default function ContactPage() {
  return (
    <InfoPage label="Contact" title="Talk to the Stepit team" intro="Partnerships, press, support or security reports.">
      <div className="grid gap-4 sm:grid-cols-2">
        <a href={`mailto:${CONTACT}`} className="glass group rounded-3xl p-6 transition hover:border-lime-400/40">
          <Mail className="h-6 w-6 text-lime-400" />
          <div className="mt-4 font-display text-lg font-semibold">{CONTACT}</div>
          <p className="mt-1 text-sm text-white/55">General enquiries and partnerships</p>
        </a>
        <a href={`mailto:${SECURITY}`} className="glass group rounded-3xl p-6 transition hover:border-lime-400/40">
          <MessageCircle className="h-6 w-6 text-lime-400" />
          <div className="mt-4 font-display text-lg font-semibold">{SECURITY}</div>
          <p className="mt-1 text-sm text-white/55">Responsible disclosure</p>
        </a>
      </div>
      <Section title="Support">
        <p>Stepit staff will never DM you first and will never ask for your seed phrase or private key. Anyone who does is a scammer.</p>
      </Section>
    </InfoPage>
  );
}
