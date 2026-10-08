/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The custom server (server.ts) owns the HTTP listener and the WebSocket
  // endpoint; Next only renders pages and route handlers.
  webpack: (config) => {
    // wallet-adapter pulls in optional React Native / node modules we do not ship.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      "pino-pretty": false,
    };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};
export default nextConfig;
