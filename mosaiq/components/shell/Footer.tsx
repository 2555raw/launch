import Link from "next/link";
import { pads } from "@/lib/pads";
import { legalPages, nav, site } from "@/lib/site";
import { Logo } from "@/components/ui/Logo";
import { XIcon } from "@/components/ui/XIcon";

export function Footer() {
  const year = new Date().getFullYear();
  const linkCls = "text-sm text-fog transition-colors hover:text-bone";
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-mute">
            An independent launch studio for {pads.map((p) => p.name).join(", ").replace(/, ([^,]*)$/, " and $1")}. Not affiliated with any of them.
          </p>
          {site.social.x && (
            <a href={site.social.x.url} target="_blank" rel="noopener noreferrer" className={`${linkCls} mt-5 inline-flex items-center gap-2`}>
              <XIcon className="size-3.5" /> {site.social.x.handle}
            </a>
          )}
          <p className="mt-3 text-sm text-mute">© {year} {site.name}</p>
        </div>
        <FooterCol title="Product">
          {nav.slice(1).map((n) => (
            <Link key={n.href} href={n.href} className={linkCls}>
              {n.label}
            </Link>
          ))}
        </FooterCol>
        <FooterCol title="Launchpads">
          {pads.slice(0, 4).map((p) => (
            <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className={linkCls}>
              {p.name}
            </a>
          ))}
        </FooterCol>
        <FooterCol title="Legal">
          {legalPages.map((l) => (
            <Link key={l.href} href={l.href} className={linkCls}>
              {l.label}
            </Link>
          ))}
        </FooterCol>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-medium">{title}</h2>
      <div className="mt-4 flex flex-col items-start gap-2.5">{children}</div>
    </div>
  );
}
