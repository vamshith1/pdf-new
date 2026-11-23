"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { categories, tools, type Category } from "@/lib/tools";
import { ToolTile } from "./ToolCard";

/** "All tools" button: click to open the menu; click again, outside, or press Esc to close. */
export default function AllToolsMenu() {
  const pathname = usePathname();
  // Remember which page the menu was opened on, so it closes by itself after navigating
  const [openOn, setOpenOn] = useState<string | null>(null);
  const isOpen = openOn === pathname;
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpenOn(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenOn(null);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  const groups = Object.keys(categories) as Category[];

  return (
    <div ref={root} className="md:relative">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setOpenOn(isOpen ? null : pathname)}
        className={`flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition-colors ${
          isOpen ? "bg-accent-hover" : "bg-accent hover:bg-accent-hover"
        }`}
      >
        {isOpen ? "Close" : "All tools"}
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden
          className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div
          id={menuId}
          className="animate-rise absolute inset-x-3 top-[4.25rem] z-40 max-h-[calc(100vh-5.5rem)] overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-2xl md:inset-x-auto md:top-12 md:right-0 md:w-[min(46rem,calc(100vw-2rem))]"
        >
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {groups.map((g) => (
              <div key={g}>
                <p className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wider text-muted uppercase">
                  <span className="h-2 w-2 rounded-full" style={{ background: categories[g].color }} />
                  {categories[g].label}
                </p>
                <ul className="space-y-1">
                  {tools.filter((t) => t.category === g).map((t) => (
                    <li key={t.slug}>
                      <Link
                        href={`/${t.slug}`}
                        onClick={() => setOpenOn(null)}
                        aria-current={pathname === `/${t.slug}` ? "page" : undefined}
                        className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors hover:bg-surface-2 aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent"
                      >
                        <ToolTile tool={t} size={30} />
                        {t.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
