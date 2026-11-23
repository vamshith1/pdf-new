"use client";

import { useState } from "react";
import ToolCard from "./ToolCard";
import { categories, tools, type Category } from "@/lib/tools";

type Filter = Category | "all";

/** Home page tool list with a search box and category filters. */
export default function ToolGrid() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const q = query.trim().toLowerCase();

  const shown = tools.filter(
    (t) =>
      (filter === "all" || t.category === filter) &&
      (!q || `${t.name} ${t.summary}`.toLowerCase().includes(q)),
  );
  const filters: Filter[] = ["all", ...(Object.keys(categories) as Category[])];

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Filter tools" className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-text aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-white"
            >
              {f === "all" ? "All" : categories[f].label}
            </button>
          ))}
        </div>
        <label className="relative block sm:w-72">
          <span className="sr-only">Search tools</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools, e.g. compress"
            className="h-11 w-full rounded-xl border border-border bg-surface pr-3 pl-10 text-[15px] outline-none transition-colors placeholder:text-muted focus:border-accent"
          />
        </label>
      </div>

      {shown.length ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((t) => (
            <ToolCard key={t.slug} tool={t} />
          ))}
        </div>
      ) : (
        <p className="mt-10 text-center text-muted">
          No tool matches &ldquo;{query}&rdquo;.{" "}
          <button type="button" className="font-semibold text-accent hover:underline" onClick={() => { setQuery(""); setFilter("all"); }}>
            Show all tools
          </button>
        </p>
      )}
    </div>
  );
}
