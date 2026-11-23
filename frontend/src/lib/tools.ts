// Catalogue of tools: drives the home page grid, the tool pages, SEO text and the API call.

export type Category = "organize" | "optimize" | "convert" | "security";

export type ToolSlug =
  | "merge-pdf"
  | "split-pdf"
  | "organize-pdf"
  | "rotate-pdf"
  | "compress-pdf"
  | "jpg-to-pdf"
  | "pdf-to-jpg"
  | "protect-pdf"
  | "unlock-pdf";

export interface Tool {
  slug: ToolSlug;
  /** Backend tool id: POST /api/v1/tools/{apiId}/jobs */
  apiId: string;
  name: string;
  /** One line for cards. */
  summary: string;
  /** Page heading and subheading. */
  heading: string;
  subheading: string;
  category: Category;
  accept: string; // for <input accept>
  acceptLabel: string;
  multiple: boolean;
  minFiles: number;
  /** Label of the main action button. */
  action: string;
  /** Tools to suggest after this one finishes. */
  next: ToolSlug[];
  steps: string[];
  faq: { q: string; a: string }[];
  seoTitle: string;
  seoDescription: string;
}

const PDF = "application/pdf,.pdf";
const IMAGES = "image/jpeg,image/png,image/webp,image/gif,image/bmp,image/tiff,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tif,.tiff";

export const categories: Record<Category, { label: string; color: string }> = {
  organize: { label: "Organize", color: "var(--cat-organize)" },
  optimize: { label: "Optimize", color: "var(--cat-optimize)" },
  convert: { label: "Convert", color: "var(--cat-convert)" },
  security: { label: "Security", color: "var(--cat-security)" },
};

export const tools: Tool[] = [
  {
    slug: "merge-pdf",
    apiId: "merge",
    name: "Merge PDF",
    summary: "Combine several PDFs into one file, in the order you choose.",
    heading: "Merge PDF files",
    subheading: "Combine PDFs into one document. Drag to set the order.",
    category: "organize",
    accept: PDF,
    acceptLabel: "PDF files",
    multiple: true,
    minFiles: 2,
    action: "Merge PDFs",
    next: ["compress-pdf", "protect-pdf", "organize-pdf"],
    steps: ["Add two or more PDF files.", "Drag the files into the order you want.", "Click Merge PDFs and download the result."],
    faq: [
      { q: "Is there a limit on how many PDFs I can merge?", a: "You can merge up to 20 files at once, up to 100 MB in total." },
      { q: "Will bookmarks and links be kept?", a: "Yes. Page content, links and bookmarks from each file are carried over." },
      { q: "Is it safe to merge confidential files?", a: "Files are processed on our server over HTTPS and deleted automatically within an hour. You can also delete them right away after downloading." },
    ],
    seoTitle: "Merge PDF – Combine PDF files online for free",
    seoDescription: "Combine multiple PDFs into one file in seconds. Free, no sign-up, and files are deleted automatically.",
  },
  {
    slug: "split-pdf",
    apiId: "split",
    name: "Split PDF",
    summary: "Extract page ranges or split every page into its own PDF.",
    heading: "Split PDF",
    subheading: "Extract page ranges, or split a PDF into separate files.",
    category: "organize",
    accept: PDF,
    acceptLabel: "a PDF file",
    multiple: false,
    minFiles: 1,
    action: "Split PDF",
    next: ["merge-pdf", "compress-pdf"],
    steps: ["Choose a PDF.", "Pick ranges, a fixed number of pages per file, or one file per page.", "Download a PDF, or a ZIP if there are several files."],
    faq: [
      { q: "How do I write page ranges?", a: "Use commas between ranges, like 1-3, 4-6, 9. Each range becomes its own PDF. Open-ended ranges work too: 8- means page 8 to the end." },
      { q: "Why did I get a ZIP file?", a: "When the split produces more than one PDF, they're bundled into a single ZIP so you only download once." },
    ],
    seoTitle: "Split PDF – Extract pages from a PDF online",
    seoDescription: "Split a PDF by page ranges or into single pages. Free, fast and private.",
  },
  {
    slug: "organize-pdf",
    apiId: "organize",
    name: "Organize PDF",
    summary: "Reorder, delete and rotate pages with a visual page grid.",
    heading: "Organize PDF pages",
    subheading: "Drag pages to reorder them, rotate them or remove the ones you don't need.",
    category: "organize",
    accept: PDF,
    acceptLabel: "a PDF file",
    multiple: false,
    minFiles: 1,
    action: "Save changes",
    next: ["compress-pdf", "merge-pdf"],
    steps: ["Choose a PDF to see all its pages.", "Drag to reorder, and use the buttons on each page to rotate or delete it.", "Click Save changes and download your new PDF."],
    faq: [
      { q: "Can I undo a deleted page?", a: "Yes. Deleted pages stay in the grid, greyed out, until you save. Click the page again to restore it." },
      { q: "Is the original file changed?", a: "No. You get a new PDF; your original file on your device is untouched." },
    ],
    seoTitle: "Organize PDF – Reorder, delete and rotate PDF pages",
    seoDescription: "Rearrange, remove and rotate PDF pages visually. Free online PDF organizer.",
  },
  {
    slug: "rotate-pdf",
    apiId: "rotate",
    name: "Rotate PDF",
    summary: "Turn pages the right way up, all at once or one by one.",
    heading: "Rotate PDF",
    subheading: "Rotate all pages, or just the ones that are sideways.",
    category: "organize",
    accept: PDF,
    acceptLabel: "a PDF file",
    multiple: false,
    minFiles: 1,
    action: "Rotate PDF",
    next: ["compress-pdf", "organize-pdf"],
    steps: ["Choose a PDF.", "Rotate every page, or click individual pages to rotate them.", "Download the rotated PDF."],
    faq: [
      { q: "Is the rotation permanent?", a: "Yes. The new PDF opens with the pages turned the way you chose, in every PDF reader." },
      { q: "Does rotating reduce quality?", a: "No. Rotation only changes page orientation; text and images aren't re-encoded." },
    ],
    seoTitle: "Rotate PDF – Rotate PDF pages online for free",
    seoDescription: "Rotate all or selected PDF pages permanently. Free, no sign-up.",
  },
  {
    slug: "compress-pdf",
    apiId: "compress",
    name: "Compress PDF",
    summary: "Make PDFs smaller while keeping them readable.",
    heading: "Compress PDF",
    subheading: "Reduce file size for email and uploads, with the quality you choose.",
    category: "optimize",
    accept: PDF,
    acceptLabel: "a PDF file",
    multiple: false,
    minFiles: 1,
    action: "Compress PDF",
    next: ["protect-pdf", "merge-pdf"],
    steps: ["Choose a PDF.", "Pick a compression level. Recommended suits most files.", "Download the smaller PDF and see how much you saved."],
    faq: [
      { q: "How much smaller will my file get?", a: "It depends on the content. Scans and photo-heavy PDFs often shrink by 50–90%. Text-only PDFs are already small and may barely change." },
      { q: "Will text become blurry?", a: "No. Only embedded images are resized and re-encoded. Text and vector graphics stay sharp." },
      { q: "What if the file doesn't get smaller?", a: "We never give you a bigger file. If your PDF is already optimised, you get the original back." },
    ],
    seoTitle: "Compress PDF – Reduce PDF file size online",
    seoDescription: "Shrink PDF files for email and uploads while keeping text sharp. Free and private.",
  },
  {
    slug: "jpg-to-pdf",
    apiId: "jpg-to-pdf",
    name: "JPG to PDF",
    summary: "Turn photos and images into a PDF, one image per page.",
    heading: "JPG to PDF",
    subheading: "Convert JPG, PNG, WebP and other images to a PDF.",
    category: "convert",
    accept: IMAGES,
    acceptLabel: "images (JPG, PNG, WebP…)",
    multiple: true,
    minFiles: 1,
    action: "Convert to PDF",
    next: ["compress-pdf", "merge-pdf"],
    steps: ["Add one or more images.", "Drag them into order and choose page size and margins.", "Download your PDF."],
    faq: [
      { q: "Which image formats are supported?", a: "JPG, PNG, WebP, GIF, BMP and TIFF." },
      { q: "Will my photos lose quality?", a: "No. JPGs are placed in the PDF exactly as they are, and other formats are stored losslessly." },
      { q: "My phone photos are sideways in other tools. Here too?", a: "No. We read the photo's orientation so pages come out the right way up." },
    ],
    seoTitle: "JPG to PDF – Convert images to PDF online",
    seoDescription: "Convert JPG, PNG and other images to PDF without losing quality. Free and private.",
  },
  {
    slug: "pdf-to-jpg",
    apiId: "pdf-to-jpg",
    name: "PDF to JPG",
    summary: "Save each PDF page as a high-quality JPG image.",
    heading: "PDF to JPG",
    subheading: "Convert PDF pages to JPG images.",
    category: "convert",
    accept: PDF,
    acceptLabel: "a PDF file",
    multiple: false,
    minFiles: 1,
    action: "Convert to JPG",
    next: ["jpg-to-pdf", "compress-pdf"],
    steps: ["Choose a PDF.", "Pick the image quality and which pages to convert.", "Download a JPG, or a ZIP with all pages."],
    faq: [
      { q: "What resolution are the images?", a: "Standard is 150 DPI, good for screens. High is 300 DPI, good for printing. Low is 72 DPI for small previews." },
      { q: "Can I convert just one page?", a: "Yes. Type the page numbers you want, like 2 or 1-3, 7." },
    ],
    seoTitle: "PDF to JPG – Convert PDF pages to images",
    seoDescription: "Turn PDF pages into JPG images at up to 300 DPI. Free online converter.",
  },
  {
    slug: "protect-pdf",
    apiId: "protect",
    name: "Protect PDF",
    summary: "Add a password so only people you trust can open it.",
    heading: "Protect PDF with a password",
    subheading: "Encrypt your PDF with AES-256. The password is needed to open it.",
    category: "security",
    accept: PDF,
    acceptLabel: "a PDF file",
    multiple: false,
    minFiles: 1,
    action: "Protect PDF",
    next: [], // an encrypted file can't be processed further without unlocking
    steps: ["Choose a PDF.", "Type a password and confirm it.", "Download the encrypted PDF."],
    faq: [
      { q: "How strong is the encryption?", a: "AES-256, the strongest standard PDF encryption, supported by all modern PDF readers." },
      { q: "Do you store my password?", a: "No. It's used once to encrypt the file and is never saved or logged." },
      { q: "What if I forget the password?", a: "It can't be recovered, so keep it somewhere safe or keep an unprotected copy." },
    ],
    seoTitle: "Protect PDF – Add a password to a PDF",
    seoDescription: "Encrypt PDFs with AES-256 password protection. Free, private, no sign-up.",
  },
  {
    slug: "unlock-pdf",
    apiId: "unlock",
    name: "Unlock PDF",
    summary: "Remove the password and restrictions from a PDF you can open.",
    heading: "Unlock PDF",
    subheading: "Remove a PDF's password and printing or editing restrictions.",
    category: "security",
    accept: PDF,
    acceptLabel: "a PDF file",
    multiple: false,
    minFiles: 1,
    action: "Unlock PDF",
    next: ["compress-pdf", "merge-pdf", "organize-pdf"],
    steps: ["Choose a protected PDF.", "Enter its password, or leave it blank if it only has editing restrictions.", "Download the unlocked PDF."],
    faq: [
      { q: "Can you unlock a PDF without the password?", a: "Only when the file opens without one but blocks printing or editing. Files that need a password to open require that password." },
      { q: "Is unlocking legal?", a: "Unlock only files you own or have permission to use." },
    ],
    seoTitle: "Unlock PDF – Remove a PDF password",
    seoDescription: "Remove passwords and restrictions from PDFs you have access to. Free and private.",
  },
];

export const toolBySlug = Object.fromEntries(tools.map((t) => [t.slug, t])) as Record<ToolSlug, Tool>;
