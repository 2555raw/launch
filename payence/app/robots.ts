import type { MetadataRoute } from "next";

const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

/** The app, the checkout and the API are never for crawlers. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/wallet", "/send", "/receive", "/pay", "/transactions", "/settings", "/notifications", "/merchant", "/checkout", "/api"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
