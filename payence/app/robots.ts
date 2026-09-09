import type { MetadataRoute } from "next";

/** Let everything be indexed, and point crawlers at the sitemap. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://payence.site/sitemap.xml",
  };
}
