import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://payence.dev"),
  title: "Payence — the financial layer for AI agents",
  description:
    "Payence equips autonomous agents with controlled spending, virtual cards, payment policies and real-time transaction visibility from one platform.",
  keywords: [
    "AI agents",
    "virtual cards",
    "agent payments",
    "spend controls",
    "payment infrastructure",
  ],
  openGraph: {
    type: "website",
    title: "Payence — the financial layer for AI agents",
    description:
      "Controlled spending, virtual cards, payment policies and real-time visibility for autonomous agents.",
    siteName: "Payence",
  },
  twitter: {
    card: "summary_large_image",
    title: "Payence — the financial layer for AI agents",
    description:
      "Controlled spending, virtual cards, payment policies and real-time visibility for autonomous agents.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Loaded over a link rather than next/font so the build never depends on
            reaching Google's servers. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
        />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-6 focus:top-6 focus:z-[100] focus:rounded-pill focus:bg-ink focus:px-5 focus:py-3 focus:text-sm focus:text-canvas"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
