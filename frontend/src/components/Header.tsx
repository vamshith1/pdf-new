import Link from "next/link";
import Logo from "./Logo";
import AllToolsMenu from "./AllToolsMenu";
import ThemeToggle from "./ThemeToggle";
import { tools } from "@/lib/tools";

const featured = ["merge-pdf", "split-pdf", "compress-pdf", "jpg-to-pdf", "pdf-to-jpg"];

export default function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
      <div className="relative mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href="/" aria-label="easypdf home" className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label="Popular tools" className="hidden flex-1 items-center gap-1 lg:flex">
          {tools
            .filter((t) => featured.includes(t.slug))
            .map((t) => (
              <Link
                key={t.slug}
                href={`/${t.slug}`}
                className="rounded-lg px-3 py-2 text-[15px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text"
              >
                {t.name}
              </Link>
            ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <AllToolsMenu />
        </div>
      </div>
    </header>
  );
}
