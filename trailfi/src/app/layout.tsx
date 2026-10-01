import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers/Providers";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: { default: "Stepit · Walk. Explore. Earn.", template: "%s · Stepit" },
  description:
    "Stepit turns your daily steps into crypto rewards. Explore the outdoors, stay active and earn a share of platform fees.",
  openGraph: {
    title: "Stepit · Walk. Explore. Earn.",
    description: "Your steps. Your rewards. Your adventure.",
    images: [{ url: "/images/hero-trail.jpg", width: 2560, height: 1708 }],
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#060807",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
