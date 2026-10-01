import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Images are served pre-sized from /public; resizing them on request used too much memory.
  images: { unoptimized: true },
  // PGlite ships a WASM build of Postgres; keep it (and the Postgres driver) out of the bundle.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  // Migrations are read from disk at runtime by the embedded database.
  outputFileTracingIncludes: {
    "/api/**/*": ["./supabase/migrations/**/*"],
  },
  webpack: (config, { webpack }) => {
    // Optional peer deps pulled in by WalletConnect / MetaMask SDK / Coinbase SDK that are never used here.
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.resolve.fallback = { ...config.resolve.fallback, "@react-native-async-storage/async-storage": false };
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^@x402\// }));
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
