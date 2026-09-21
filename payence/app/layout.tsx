import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: {
    default: "Payence — Spend stablecoins like money",
    template: "%s",
  },
  description:
    "Hold digital euros and dollars and pay with them in shops and online. Settles in seconds, costs a fraction of a cent, and never asks you to think about crypto.",
  applicationName: "Payence",
  openGraph: {
    type: "website",
    siteName: "Payence",
    title: "Payence — Spend stablecoins like money",
    description: "Stablecoin payments that feel like a card. In a shop, online, or to another person.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Payence — Spend stablecoins like money",
    description: "Stablecoin payments that feel like a card.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#F6F5F1",
  width: "device-width",
  initialScale: 1,
  // A payment app is read one-handed and often zoomed; never lock that out.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-pill focus:bg-ink focus:px-5 focus:py-3 focus:text-[14px] focus:text-canvas"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
