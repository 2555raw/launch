import type { MetadataRoute } from "next";
import { legalPages, nav, site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [...nav, ...legalPages].map((p) => ({
    url: `${site.url}${p.href === "/" ? "" : p.href}`,
    changeFrequency: p.href.startsWith("/legal") ? "yearly" : "daily",
    priority: p.href === "/" ? 1 : p.href.startsWith("/legal") ? 0.3 : 0.8,
  }));
}
