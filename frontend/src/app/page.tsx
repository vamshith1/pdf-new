import ToolGrid from "@/components/ToolGrid";
import { BoltIcon, GiftIcon, ShieldIcon, ClockIcon } from "@/components/Icons";
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
  return (
    <>
      <section style={{ background: "var(--hero)" }}>
        <div className="mx-auto max-w-4xl px-4 pt-16 pb-12 text-center sm:pt-20">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-sm font-medium text-muted">
            <ShieldIcon width={15} height={15} /> Free · No sign-up · Files deleted automatically
          </p>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-balance sm:text-6xl">
            Every PDF tool you need, <span className="text-accent">made easy</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted text-pretty sm:text-xl">
            Pick a tool, add your file, download the result. That&apos;s it.
          </p>
          <ol className="mx-auto mt-8 flex max-w-xl flex-wrap justify-center gap-x-8 gap-y-3 text-[15px] font-medium">
            {["Choose a tool", "Add your file", "Download"].map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="tools" className="mx-auto mt-10 max-w-6xl scroll-mt-24 px-4" aria-labelledby="tools-heading">
        <h2 id="tools-heading" className="mb-5 text-2xl font-bold tracking-tight">What do you want to do?</h2>
        <ToolGrid />
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
