import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Workspace from "@/components/Workspace";
import { ToolTile } from "@/components/ToolCard";
import { tools, toolBySlug, type ToolSlug } from "@/lib/tools";

// One static page per tool, generated at build time.
export const dynamicParams = false;

export function generateStaticParams() {
  return tools.map((t) => ({ tool: t.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[tool]">): Promise<Metadata> {
  const tool = toolBySlug[(await params).tool as ToolSlug];
  if (!tool) return {};
  return {
    title: tool.seoTitle,
    description: tool.seoDescription,
    alternates: { canonical: `/${tool.slug}` },
    openGraph: { title: tool.seoTitle, description: tool.seoDescription },
  };
}

export default async function ToolPage({ params }: PageProps<"/[tool]">) {
  const tool = toolBySlug[(await params).tool as ToolSlug];
  if (!tool) notFound();
  const related = tools.filter((t) => t.slug !== tool.slug && (t.category === tool.category || tool.next.includes(t.slug))).slice(0, 4);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: tool.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-12 pb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">{tool.heading}</h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-muted">{tool.subheading}</p>
      </section>

      <section id="workspace" className="mx-auto max-w-6xl scroll-mt-24 px-4">
        <Workspace tool={tool} />
      </section>

      <section className="mx-auto mt-24 grid max-w-6xl gap-12 px-4 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">How it works</h2>
          <ol className="mt-6 space-y-4">
            {tool.steps.map((s, i) => (
              <li key={s} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">{i + 1}</span>
                <span className="pt-1 text-muted">{s}</span>
              </li>
            ))}
          </ol>

          <h2 className="mt-12 text-2xl font-bold tracking-tight">Popular uses</h2>
          <ul className="mt-5 space-y-3">
            {tool.uses.map((u) => (
              <li key={u} className="flex gap-3 text-muted">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-0.5 shrink-0 text-accent">
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
                {u}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Frequently asked questions</h2>
          <div className="mt-6 divide-y divide-border rounded-2xl border border-border bg-surface">
            {tool.faq.map((f) => (
              <details key={f.q} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {f.q}
                  <span className="text-muted transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-4">
        <h2 className="text-lg font-semibold">More tools</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {related.map((t) => (
            <Link key={t.slug} href={`/${t.slug}`} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 hover:border-accent/50">
              <ToolTile tool={t} size={36} />
              <span className="text-sm font-semibold">{t.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
    </>
  );
}
