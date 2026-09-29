import "./globals.css";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { AppProvider } from "@/components/shell/AppProvider";
import { Footer } from "@/components/shell/Footer";
import { MobileNav, Sidebar, Topbar } from "@/components/shell/Navigation";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} · ${site.tagline}`, template: `%s · ${site.name}` },
  description: site.description,
  applicationName: site.name,
  keywords: ["token launchpad", "launch a token", "Solana", "BNB Chain", "Base", "MCP", "AI agent", site.name],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: site.name,
    title: `${site.name} · ${site.tagline}`,
    description: site.description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    site: site.social.x.handle,
    title: `${site.name} · ${site.tagline}`,
    description: site.description,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: site.name,
  url: site.url,
  description: site.description,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only z-[100] rounded-full bg-bone px-4 py-2 text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <AppProvider>
          <div aria-hidden="true" className="backdrop pointer-events-none fixed inset-0 -z-10" />
          <Sidebar />
          <div className="flex min-h-dvh flex-col pb-20 lg:pb-0 lg:pl-[72px]">
            <Topbar />
            <main id="main" className="flex-1">
              {children}
            </main>
            <Footer />
          </div>
          <MobileNav />
        </AppProvider>
      </body>
    </html>
  );
}
