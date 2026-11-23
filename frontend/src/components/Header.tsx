import Link from "next/link";
import Logo from "./Logo";
import { tools } from "@/lib/tools";

const featured = ["merge-pdf", "split-pdf", "compress-pdf", "jpg-to-pdf", "pdf-to-jpg"];

export default function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link href="/" aria-label="Home">
          <Logo />
        </Link>
        <nav aria-label="Popular tools" className="hidden flex-1 items-center gap-1 md:flex">
          {tools
            .filter((t) => featured.includes(t.slug))
            .map((t) => (
              <Link
                key={t.slug}
                href={`/${t.slug}`}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text"
              >
                {t.name}
              </Link>
            ))}
        </nav>
        <Link
          href="/#tools"
          className="ml-auto rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover md:ml-0"
        >
          All tools
        </Link>
      </div>
    </header>
  );
}
