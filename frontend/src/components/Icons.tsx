// Inline SVG icons (24px grid, stroke-based) so there are no icon-font downloads.
import type { SVGProps } from "react";
import type { ToolSlug } from "@/lib/tools";

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...p,
});

export const UploadIcon = (p: P) => (<svg {...base(p)}><path d="M12 16V4m0 0-4 4m4-4 4 4" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>);
export const DownloadIcon = (p: P) => (<svg {...base(p)}><path d="M12 4v12m0 0 4-4m-4 4-4-4" /><path d="M4 18v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1" /></svg>);
export const TrashIcon = (p: P) => (<svg {...base(p)}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>);
export const RotateCwIcon = (p: P) => (<svg {...base(p)}><path d="M20 12a8 8 0 1 1-2.34-5.66L20 8.5" /><path d="M20 3v5.5h-5.5" /></svg>);
export const RotateCcwIcon = (p: P) => (<svg {...base(p)}><path d="M4 12a8 8 0 1 0 2.34-5.66L4 8.5" /><path d="M4 3v5.5h5.5" /></svg>);
export const PlusIcon = (p: P) => (<svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>);
export const XIcon = (p: P) => (<svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>);
export const CheckIcon = (p: P) => (<svg {...base(p)}><path d="m5 12 5 5L20 7" /></svg>);
export const AlertIcon = (p: P) => (<svg {...base(p)}><path d="M12 9v4m0 4h.01" /><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>);
export const GripIcon = (p: P) => (<svg {...base(p)}><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></svg>);
export const EyeIcon = (p: P) => (<svg {...base(p)}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>);
export const EyeOffIcon = (p: P) => (<svg {...base(p)}><path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" /></svg>);
export const ShieldIcon = (p: P) => (<svg {...base(p)}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></svg>);
export const BoltIcon = (p: P) => (<svg {...base(p)}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></svg>);
export const ClockIcon = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
export const GiftIcon = (p: P) => (<svg {...base(p)}><path d="M20 12v8H4v-8M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7Zm0 0h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7Z" /></svg>);
export const ArrowRightIcon = (p: P) => (<svg {...base(p)}><path d="M5 12h14m-6-6 6 6-6 6" /></svg>);
export const ChevronLeftIcon = (p: P) => (<svg {...base(p)}><path d="m15 18-6-6 6-6" /></svg>);
export const ChevronRightIcon = (p: P) => (<svg {...base(p)}><path d="m9 18 6-6-6-6" /></svg>);
export const LockIcon = (p: P) => (<svg {...base(p)}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>);
export const FileIcon = (p: P) => (<svg {...base(p)}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5" /></svg>);

/** Distinct glyph per tool, drawn inside a coloured tile. */
export function ToolGlyph({ slug, ...p }: P & { slug: ToolSlug }) {
  switch (slug) {
    case "merge-pdf":
      return (<svg {...base(p)}><rect x="3" y="4" width="8" height="11" rx="1.5" /><rect x="13" y="9" width="8" height="11" rx="1.5" /><path d="M11 9.5h4m0 0-1.5-1.5M15 9.5 13.5 11" /></svg>);
    case "split-pdf":
      return (<svg {...base(p)}><rect x="3" y="4" width="7" height="16" rx="1.5" /><rect x="14" y="4" width="7" height="16" rx="1.5" /><path d="M12 3v18" strokeDasharray="2 2" /></svg>);
    case "organize-pdf":
      return (<svg {...base(p)}><rect x="3" y="3" width="7" height="8" rx="1.5" /><rect x="14" y="3" width="7" height="8" rx="1.5" /><rect x="3" y="13" width="7" height="8" rx="1.5" /><rect x="14" y="13" width="7" height="8" rx="1.5" /></svg>);
    case "rotate-pdf":
      return (<svg {...base(p)}><rect x="7" y="7" width="10" height="13" rx="1.5" /><path d="M4 9a8 8 0 0 1 12.5-5.5M17 1.5v3h-3" /></svg>);
    case "compress-pdf":
      return (<svg {...base(p)}><path d="M12 3v6m0 0-3-3m3 3 3-3M12 21v-6m0 0-3 3m3-3 3 3M4 12h16" /></svg>);
    case "jpg-to-pdf":
      return (<svg {...base(p)}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-9 9" /></svg>);
    case "pdf-to-jpg":
      return (<svg {...base(p)}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><circle cx="10" cy="12" r="1.5" /><path d="m19 18-4-4-6 6" /></svg>);
    case "protect-pdf":
      return (<svg {...base(p)}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4M12 15v2" /></svg>);
    case "unlock-pdf":
      return (<svg {...base(p)}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.5-2M12 15v2" /></svg>);
    case "word-to-pdf":
      return (<svg {...base(p)}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="m8.5 11 1.3 6 1.7-4.5 1.7 4.5 1.3-6" /></svg>);
    case "excel-to-pdf":
      return (<svg {...base(p)}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 10h16M4 15h16M10 4v16" /></svg>);
    case "powerpoint-to-pdf":
      return (<svg {...base(p)}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M12 16v4M8 20h8M9 12V8h2.5a1.5 1.5 0 0 1 0 3H9" /></svg>);
    case "pdf-to-word":
      return (<svg {...base(p)}><path d="M4 12h8m0 0-3-3m3 3-3 3" /><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /></svg>);
    case "pdf-to-text":
      return (<svg {...base(p)}><path d="M5 6h14M5 10h14M5 14h10M5 18h7" /></svg>);
    case "extract-images":
      return (<svg {...base(p)}><rect x="3" y="3" width="13" height="13" rx="2" /><path d="m3 13 4-4 4 4M20 8v12H8" /></svg>);
    case "ocr-pdf":
      return (<svg {...base(p)}><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M8 10h8M8 14h5" /></svg>);
    case "watermark-pdf":
      return (<svg {...base(p)}><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" /></svg>);
    case "add-page-numbers":
      return (<svg {...base(p)}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M11 13h1.5v5M10.5 18h4" /></svg>);
  }
}
