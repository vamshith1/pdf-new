import Link from "next/link";
import Logo from "./Logo";
import { categories, tools, type Category } from "@/lib/tools";
import { brand } from "@/lib/brand";

export default function Footer() {
  const groups = Object.keys(categories) as Category[];
  return (
    <footer className="mt-24 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted">{brand.description}</p>
        </div>
        {groups.map((g) => (
          <div key={g}>
            <h2 className="text-sm font-semibold">{categories[g].label}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {tools
                .filter((t) => t.category === g)
                .map((t) => (
                  <li key={t.slug}>
                    <Link href={`/${t.slug}`} className="text-muted hover:text-text">
                      {t.name}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-sm text-muted">
          <span>© {brand.name}. Files are deleted automatically after processing.</span>
          <span className="flex gap-4">
            <Link href="/privacy" className="hover:text-text">Privacy</Link>
            <Link href="/terms" className="hover:text-text">Terms</Link>
            {/* Served by the backend, not a Next.js page */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/api/docs" className="hover:text-text">API</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
