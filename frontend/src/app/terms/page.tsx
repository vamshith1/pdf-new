import type { Metadata } from "next";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Terms", description: `Terms of use for ${brand.name}.` };

export default function Terms() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 leading-relaxed">
      <h1 className="text-4xl font-bold tracking-tight">Terms of use</h1>
      <ul className="mt-6 list-disc space-y-3 pl-5 text-muted">
        <li>{brand.name} is provided free of charge, as is, without warranties.</li>
        <li>Only upload files you own or have the right to process. Don&apos;t use the Unlock tool on files you aren&apos;t allowed to open.</li>
        <li>Don&apos;t abuse the service: automated bulk use, attempts to overload it, or uploading malware isn&apos;t allowed. Requests may be rate-limited.</li>
        <li>Keep your own copies of important files. Results are deleted automatically after one hour.</li>
      </ul>
    </article>
  );
}
