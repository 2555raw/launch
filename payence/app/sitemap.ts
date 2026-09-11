import type { MetadataRoute } from "next";

/** One page, but Search Console asks for a sitemap and this keeps it honest. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://payence.site",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
