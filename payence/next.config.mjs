/** @type {import('next').NextConfig} */
const snapshot = process.env.NEXT_PUBLIC_SNAPSHOT === "1";

// GitHub Pages serves a project site from /<repo>, so the export needs to know
// that prefix or every asset 404s. BASE_PATH is set by the workflow; it stays
// empty for local development and for hosts that serve from the root.
const basePath = process.env.BASE_PATH || "";
const pages = process.env.PAGES === "1";

const nextConfig = {
  reactStrictMode: true,
  // `npm run snapshot` exports the page as flat HTML so it can be published as
  // a single file; the normal build is untouched.
  ...(snapshot ? { output: "export", distDir: ".next-snapshot" } : {}),
  // `npm run build:pages` exports the real app for a static host.
  ...(pages
    ? {
        output: "export",
        basePath,
        assetPrefix: basePath || undefined,
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
