import Link from "next/link";
import ToolCard from "@/components/ToolCard";
import { BoltIcon, GiftIcon, ShieldIcon, ClockIcon } from "@/components/Icons";
import { categories, tools, type Category } from "@/lib/tools";
import { brand } from "@/lib/brand";

const features = [
  { icon: ShieldIcon, title: "Private by design", body: "Files travel over HTTPS and are deleted automatically within an hour. Delete them yourself any time." },
  { icon: BoltIcon, title: "Fast", body: "Most files are ready in a few seconds, with no software to install." },
  { icon: GiftIcon, title: "Free, no sign-up", body: "Every tool is free to use. No account, no email, no watermark." },
  { icon: ClockIcon, title: "Works everywhere", body: "Use it on Windows, Mac, Linux, iPhone or Android, in any modern browser." },
];

const faq = [
  { q: `Is ${brand.name} really free?`, a: "Yes. All tools are free, with generous file limits and no watermarks." },
  { q: "What happens to my files?", a: "They're processed on our server and deleted automatically within an hour. Nothing is kept, shared or used for anything else." },
  { q: "Is there a file size limit?", a: "Each file can be up to 50 MB, and up to 100 MB per task." },
  { q: "Do I need to install anything?", a: "No. Everything runs in your browser, on any device." },
];

export default function Home() {
  const groups = Object.keys(categories) as Category[];
  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 h-[480px] opacity-60"
          style={{ background: "radial-gradient(60% 60% at 50% 30%, var(--accent-soft), transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-4xl px-4 pt-20 pb-14 text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
            <ShieldIcon width={14} height={14} /> Files deleted automatically · No sign-up
          </p>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-6xl">
            Every PDF tool you need, <span className="text-accent">in one place</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted text-pretty">
            Merge, split, compress, convert, rotate, unlock and protect PDFs. Free, fast and private.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/merge-pdf" className="rounded-xl bg-accent px-6 py-3 font-semibold text-white shadow-md hover:bg-accent-hover">
              Merge PDF
            </Link>
            <Link href="/compress-pdf" className="rounded-xl border border-border bg-surface px-6 py-3 font-semibold hover:bg-surface-2">
              Compress PDF
            </Link>
          </div>
        </div>
      </section>

      <section id="tools" className="mx-auto max-w-6xl scroll-mt-24 px-4" aria-labelledby="tools-heading">
        <h2 id="tools-heading" className="sr-only">All tools</h2>
        <div className="space-y-12">
          {groups.map((g) => (
            <div key={g}>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-wide text-muted uppercase">
                <span className="h-2 w-2 rounded-full" style={{ background: categories[g].color }} />
                {categories[g].label}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {tools.filter((t) => t.category === g).map((t) => <ToolCard key={t.slug} tool={t} />)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-24 max-w-6xl px-4" aria-labelledby="why">
        <h2 id="why" className="text-center text-3xl font-bold tracking-tight">Why people use {brand.name}</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-surface p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><f.icon width={20} height={20} /></span>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-24 max-w-3xl px-4" aria-labelledby="faq">
        <h2 id="faq" className="text-center text-3xl font-bold tracking-tight">Questions</h2>
        <div className="mt-8 divide-y divide-border rounded-2xl border border-border bg-surface">
          {faq.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                {f.q}
                <span className="text-muted transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
