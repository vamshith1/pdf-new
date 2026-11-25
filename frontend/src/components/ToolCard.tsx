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
      title={tool.summary}
      className="group flex aspect-square flex-col items-center justify-center gap-2.5 rounded-2xl border border-border bg-surface p-2 text-center shadow-card transition-all hover:-translate-y-0.5 hover:border-accent/60"
    >
      <ToolTile tool={tool} size={46} />
      <span className="text-[13px] leading-tight font-semibold group-hover:text-accent sm:text-sm">{tool.name}</span>
    </Link>
  );
}
