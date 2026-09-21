import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LEGAL_DOCS, type LegalDoc } from "@/lib/legal";
import { Alert } from "@/components/ui/Alert";

export function generateStaticParams() {
  return [{ doc: "terms" }, { doc: "privacy" }];
}

export function generateMetadata({ params }: { params: { doc: string } }): Metadata {
  const doc = LEGAL_DOCS[params.doc as LegalDoc["id"]];
  return { title: doc ? `${doc.title} · Payence` : "Not found" };
}

export default function LegalPage({ params }: { params: { doc: string } }) {
  const doc = LEGAL_DOCS[params.doc as LegalDoc["id"]];
  if (!doc) notFound();

  return (
    <article className="shell max-w-3xl py-14 md:py-20">
      <h1 className="text-[34px] font-extrabold tracking-[-0.035em] md:text-[44px]">{doc.title}</h1>
      <p className="mt-2 text-[13px] text-muted">{doc.updated}</p>

      <div className="mt-7">
        <Alert tone="warning" title="Template text.">
          This is written for a demonstration build and has not been reviewed by a lawyer. Replace it with text from
          counsel before anyone relies on it.
        </Alert>
      </div>

      <p className="mt-8 max-w-[68ch] text-[16px] leading-[1.7] text-muted">{doc.intro}</p>

      <div className="mt-10 space-y-9">
        {doc.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-[17px] font-bold tracking-tight">{s.heading}</h2>
            {s.body.map((p, i) => (
              <p key={i} className="mt-3 max-w-[68ch] text-[15px] leading-[1.75] text-muted">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
