/** @type {import('next').NextConfig} */
const snapshot = process.env.NEXT_PUBLIC_SNAPSHOT === "1";

const nextConfig = {
  reactStrictMode: true,
  // `npm run snapshot` exports the page as flat HTML so it can be published as
  // a single file; the normal build is untouched.
  ...(snapshot ? { output: "export", distDir: ".next-snapshot" } : {}),
};

export default nextConfig;
