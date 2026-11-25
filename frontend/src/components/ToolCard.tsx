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
      className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-3 shadow-card transition-all hover:-translate-y-0.5 hover:border-accent/50 sm:p-3.5"
    >
      <ToolTile tool={tool} size={38} />
      <span className="min-w-0">
        <span className="block text-[15px] leading-snug font-semibold group-hover:text-accent">{tool.name}</span>
        <span className="mt-0.5 hidden text-[13px] leading-snug text-muted sm:line-clamp-1">{tool.summary}</span>
      </span>
    </Link>
  );
}
