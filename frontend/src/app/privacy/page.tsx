import type { Metadata } from "next";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Privacy", description: `How ${brand.name} handles your files.` };

export default function Privacy() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 leading-relaxed">
      <h1 className="text-4xl font-bold tracking-tight">Privacy</h1>
      <p className="mt-4 text-muted">Short version: we process your files to give you the result, then delete them. That&apos;s it.</p>
      <h2 className="mt-10 text-xl font-semibold">Your files</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
        <li>Files are uploaded over HTTPS and stored only while your task runs.</li>
        <li>Your original files are deleted as soon as processing finishes.</li>
        <li>Results are deleted automatically after one hour, or immediately when you click &quot;Delete now&quot;.</li>
        <li>We never read, share, sell or use your documents for anything other than the tool you chose.</li>
        <li>Passwords you enter for Protect or Unlock are used once and never stored or logged.</li>
      </ul>
      <h2 className="mt-10 text-xl font-semibold">What we log</h2>
      <p className="mt-3 text-muted">Basic technical logs (which tool ran, how long it took, file size) to keep the service working. No file contents or file names are logged.</p>
      <h2 className="mt-10 text-xl font-semibold">Cookies</h2>
      <p className="mt-3 text-muted">{brand.name} doesn&apos;t use tracking or advertising cookies.</p>
    </article>
  );
}
