import Link from "next/link";
import { categories, type Tool } from "@/lib/tools";
import { ToolGlyph } from "./Icons";

export function ToolTile({ tool, size = 44 }: { tool: Tool; size?: number }) {
  const color = categories[tool.category].color;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-xl"
      style={{ width: size, height: size, color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <ToolGlyph slug={tool.slug} width={size * 0.55} height={size * 0.55} />
    </span>
  );
}

export default function ToolCard({ tool }: { tool: Tool }) {
  return (
    <Link
      href={`/${tool.slug}`}
      className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-accent/50"
    >
      <ToolTile tool={tool} />
      <span className="font-semibold group-hover:text-accent">{tool.name}</span>
      <span className="text-sm leading-relaxed text-muted">{tool.summary}</span>
    </Link>
  );
}
