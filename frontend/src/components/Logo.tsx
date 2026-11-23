/** EasyPDF mark + wordmark. */
export default function Logo() {
  return (
    <span className="flex items-center gap-2 font-bold tracking-tight text-text">
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden>
        <rect width="30" height="30" rx="9" fill="var(--accent)" />
        <path d="M10 7h7.5l4.5 4.5V22a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 9 22V8.5A1.5 1.5 0 0 1 10.5 7Z" fill="#fff" />
        <path d="M17.5 7v4.5H22" fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="m11.8 16.6 2.2 2.2 4.4-4.6" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-xl leading-none">
        easy<span className="text-accent">pdf</span>
      </span>
    </span>
  );
}
