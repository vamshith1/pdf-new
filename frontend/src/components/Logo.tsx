import { brand } from "@/lib/brand";

/** Placeholder mark + wordmark. Replace the SVG when the real logo is ready. */
export default function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight text-text">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <rect width="28" height="28" rx="8" fill="var(--accent)" />
        <path d="M9 7h7l4 4v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" fill="white" opacity="0.95" />
        <path d="M16 7v4h4" fill="none" stroke="var(--accent)" strokeWidth="1.4" />
        <path d="M11 15h6M11 18h4" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span className="text-[17px]">{brand.name}</span>
    </span>
  );
}
