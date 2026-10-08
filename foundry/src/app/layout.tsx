import type { Metadata, Viewport } from "next";
import "./globals.css";
import { WalletContextProvider } from "@/components/providers/WalletProvider";

export const metadata: Metadata = {
  title: "FOUNDRY — Mine. Burn. Launch.",
  description: "A community clicker that decides how much of a commodity token's supply is burned before it launches on Solana.",
};

export const viewport: Viewport = { themeColor: "#07090d", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
        <link rel="icon" href="/logo.svg" type="image/svg+xml" />
      </head>
      <body className="min-h-screen bg-ink-950 text-slate-200 font-body antialiased">
        <WalletContextProvider>{children}</WalletContextProvider>
      </body>
    </html>
  );
}
