import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://vayora.anup-travels.workers.dev";
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/airport`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/booking`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
