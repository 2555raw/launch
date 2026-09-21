import type { MetadataRoute } from "next";

const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/developers`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/developers/api`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/legal/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/legal/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/signup`, lastModified: now, changeFrequency: "yearly", priority: 0.8 },
  ];
}
