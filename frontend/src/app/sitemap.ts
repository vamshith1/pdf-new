import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";
import { tools } from "@/lib/tools";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", ...tools.map((t) => `/${t.slug}`), "/privacy", "/terms"].map((path) => ({
    url: `${brand.siteUrl}${path}`,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : path.endsWith("-pdf") || path.includes("-to-") ? 0.8 : 0.3,
  }));
}
