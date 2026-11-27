"use client";

import type { ToolSlug } from "@/lib/tools";
import { ChoiceCards, PasswordField, Segmented, TextField } from "./ui";

export type Options = Record<string, string>;

export const defaultOptions: Record<ToolSlug, Options> = {
  "merge-pdf": {},
  "split-pdf": { mode: "ranges", ranges: "", every: "1" },
  "organize-pdf": {},
  "rotate-pdf": {},
  "compress-pdf": { level: "medium" },
  "jpg-to-pdf": { pageSize: "a4", orientation: "auto", margin: "small" },
  "pdf-to-jpg": { quality: "normal", pageSelection: "all", pages: "" },
  "protect-pdf": { password: "", confirm: "" },
  "unlock-pdf": { password: "" },
  "edit-pdf": {},
  "watermark-pdf": { text: "CONFIDENTIAL", layout: "diagonal", size: "medium", opacity: "medium" },
  "add-page-numbers": { position: "bottom-center", format: "number", start: "1", skipFirst: "no" },
  "pdf-to-text": {},
  "extract-images": {},
  "word-to-pdf": {},
  "excel-to-pdf": {},
  "powerpoint-to-pdf": {},
  "pdf-to-word": {},
  "ocr-pdf": { language: "eng" },
};

/** Tools with no settings show a short explanation instead of an options form. */
export const noOptionsText: Partial<Record<ToolSlug, string>> = {
  "pdf-to-text": "All text is extracted in reading order, with a heading for each page.",
  "extract-images": "Every picture in the PDF is saved at its original quality. JPEGs stay JPEG; others become PNG.",
  "word-to-pdf": "Your document is converted with its layout, fonts and images kept.",
  "excel-to-pdf": "Every sheet is converted, using the print settings saved in the file.",
  "powerpoint-to-pdf": "Each slide becomes one page of the PDF.",
  "pdf-to-word": "You'll get an editable DOCX file. Scanned PDFs need OCR PDF first.",
};

/** Returns a message explaining why the action can't run yet, or null when it's ready. */
export function validate(slug: ToolSlug, o: Options, pageCount?: number): string | null {
  switch (slug) {
    case "split-pdf":
      if (o.mode === "ranges" && !o.ranges.trim()) return "Enter the page ranges to extract.";
      if (o.mode === "every" && !(Number(o.every) >= 1)) return "Enter how many pages each file should have.";
      if (o.mode === "every" && pageCount && Number(o.every) >= pageCount) return `This PDF has ${pageCount} pages, so choose fewer pages per file.`;
      return null;
    case "pdf-to-jpg":
      return o.pageSelection === "custom" && !o.pages.trim() ? "Enter the pages to convert." : null;
    case "protect-pdf":
      if (o.password.length < 4) return "Password must be at least 4 characters.";
      if (o.password !== o.confirm) return "Passwords don't match.";
      return null;
    case "watermark-pdf":
      if (!o.text.trim()) return "Type the watermark text.";
      if (o.text.length > 60) return "Keep the watermark under 60 characters.";
      return null;
    case "add-page-numbers":
      return /^\d{1,6}$/.test(o.start) ? null : "The first number must be a whole number.";
    default:
      return null;
  }
}

/** Options sent to the API (drops UI-only fields). */
export function toApiOptions(slug: ToolSlug, o: Options): Options {
  switch (slug) {
    case "split-pdf":
      return o.mode === "ranges" ? { mode: "ranges", ranges: o.ranges } : o.mode === "every" ? { mode: "every", every: o.every } : { mode: "all" };
    case "pdf-to-jpg":
      return { quality: o.quality, pages: o.pageSelection === "custom" ? o.pages : "all" };
    case "protect-pdf":
      return { password: o.password };
    case "add-page-numbers":
      return { position: o.position, format: o.format, start: o.start, pages: o.skipFirst === "yes" ? "2-" : "all" };
    default:
      return { ...o };
  }
}

/** Live mini-page showing roughly how the watermark will look. */
function WatermarkPreview({ text, layout, size, opacity }: { text: string; layout: string; size: string; opacity: string }) {
  // Same rules as the server, scaled to a 144 px wide A4 page: 60 pt ≈ 14.5 px, shrink to fit
  const base = { small: 8.7, medium: 14.5, large: 21.8 }[size] ?? 14.5;
  const room = (layout === "diagonal" ? 250 : 144) * 0.85;
  const fontSize = Math.min(base, room / (0.66 * Math.max(1, text.length)));
  const alpha = { light: 0.15, medium: 0.3, strong: 0.5 }[opacity] ?? 0.3;
  return (
    <div aria-hidden className="mx-auto flex aspect-[1/1.414] w-36 items-center justify-center overflow-hidden rounded-md border border-border bg-[#efe3c4] shadow-sm">
      <span
        className="font-bold whitespace-nowrap text-black"
        style={{ fontSize, opacity: alpha, transform: layout === "diagonal" ? "rotate(-54.7deg)" : "none" }}
      >
        {text || " "}
      </span>
    </div>
  );
}

/** A sensible example for the ranges field, based on the real page count. */
function rangeExample(pages?: number): string {
  if (!pages || pages < 2) return "e.g. 1-3, 4-6";
  if (pages === 2) return "e.g. 1, 2";
  const half = Math.ceil(pages / 2);
  const second = half + 1 === pages ? `${pages}` : `${half + 1}-${pages}`;
  return `e.g. 1-${half}, ${second}`;
}

export default function ToolOptions({
  slug,
  options,
  set,
  pageCount,
}: {
  slug: ToolSlug;
  options: Options;
  set: (patch: Options) => void;
  pageCount?: number;
}) {
  const o = options;
  switch (slug) {
    case "split-pdf":
      return (
        <div className="space-y-5">
          <Segmented
            label="Split mode"
            value={o.mode}
            onChange={(mode) => set({ mode })}
            options={[
              { value: "ranges", label: "Ranges" },
              { value: "every", label: "Every N" },
              { value: "all", label: "All pages" },
            ]}
          />
          {o.mode === "ranges" && (
            <TextField
              label="Page ranges"
              placeholder={rangeExample(pageCount)}
              value={o.ranges}
              onChange={(e) => set({ ranges: e.target.value })}
              hint="Each range becomes a separate PDF. Separate ranges with commas."
            />
          )}
          {o.mode === "every" && (
            <TextField
              label="Pages per file"
              type="number"
              min={1}
              max={pageCount}
              value={o.every}
              onChange={(e) => set({ every: e.target.value })}
              hint={pageCount && Number(o.every) >= 1 ? `Creates ${Math.ceil(pageCount / Number(o.every))} files.` : undefined}
            />
          )}
          {o.mode === "all" && (
            <p className="rounded-lg bg-surface-2 p-3 text-sm text-muted">
              Every page becomes its own PDF{pageCount ? ` (${pageCount} files)` : ""}, downloaded together as a ZIP.
            </p>
          )}
        </div>
      );

    case "compress-pdf":
      return (
        <ChoiceCards
          label="Compression level"
          value={o.level}
          onChange={(level) => set({ level })}
          options={[
            { value: "low", title: "Light", body: "Best quality, smaller savings." },
            { value: "medium", title: "Recommended", body: "Good quality, good compression.", badge: "Best" },
            { value: "high", title: "Strong", body: "Smallest file, lower image quality." },
          ]}
        />
      );

    case "jpg-to-pdf":
      return (
        <div className="space-y-5">
          <Segmented
            label="Page size"
            value={o.pageSize}
            onChange={(pageSize) => set({ pageSize })}
            options={[
              { value: "a4", label: "A4" },
              { value: "letter", label: "Letter" },
              { value: "fit", label: "Fit image" },
            ]}
          />
          <Segmented
            label="Orientation"
            value={o.orientation}
            disabled={o.pageSize === "fit"}
            onChange={(orientation) => set({ orientation })}
            options={[
              { value: "auto", label: "Auto" },
              { value: "portrait", label: "Portrait" },
              { value: "landscape", label: "Landscape" },
            ]}
          />
          <Segmented
            label="Margin"
            value={o.margin}
            onChange={(margin) => set({ margin })}
            options={[
              { value: "none", label: "None" },
              { value: "small", label: "Small" },
              { value: "large", label: "Large" },
            ]}
          />
        </div>
      );

    case "pdf-to-jpg":
      return (
        <div className="space-y-5">
          <Segmented
            label="Image quality"
            value={o.quality}
            onChange={(quality) => set({ quality })}
            options={[
              { value: "low", label: "Low", hint: "72 DPI" },
              { value: "normal", label: "Standard", hint: "150 DPI" },
              { value: "high", label: "High", hint: "300 DPI" },
            ]}
          />
          <Segmented
            label="Pages"
            value={o.pageSelection}
            onChange={(pageSelection) => set({ pageSelection })}
            options={[
              { value: "all", label: pageCount ? `All ${pageCount}` : "All pages" },
              { value: "custom", label: "Choose pages" },
            ]}
          />
          {o.pageSelection === "custom" && (
            <TextField
              label="Pages to convert"
              placeholder="e.g. 1-3, 7"
              value={o.pages}
              onChange={(e) => set({ pages: e.target.value })}
            />
          )}
        </div>
      );

    case "protect-pdf":
      return (
        <div className="space-y-4">
          <PasswordField label="Password" value={o.password} onChange={(password) => set({ password })} hint="At least 4 characters." />
          <PasswordField
            label="Confirm password"
            value={o.confirm}
            onChange={(confirm) => set({ confirm })}
            error={o.confirm && o.confirm !== o.password ? "Passwords don't match." : undefined}
          />
          <p className="rounded-lg bg-surface-2 p-3 text-xs leading-relaxed text-muted">
            Encrypted with AES-256. We can&apos;t recover a forgotten password, so keep it somewhere safe.
          </p>
        </div>
      );

    case "unlock-pdf":
      return (
        <PasswordField
          label="PDF password"
          value={o.password}
          onChange={(password) => set({ password })}
          autoComplete="off"
          hint="Leave blank if the file opens without a password but blocks printing or editing."
        />
      );

    case "watermark-pdf":
      return (
        <div className="space-y-5">
          <TextField
            label="Watermark text"
            value={o.text}
            maxLength={60}
            onChange={(e) => set({ text: e.target.value })}
            hint="For example CONFIDENTIAL, DRAFT or your name."
          />
          <Segmented
            label="Direction"
            value={o.layout}
            onChange={(layout) => set({ layout })}
            options={[
              { value: "diagonal", label: "Diagonal" },
              { value: "horizontal", label: "Straight" },
            ]}
          />
          <Segmented
            label="Size"
            value={o.size}
            onChange={(size) => set({ size })}
            options={[
              { value: "small", label: "Small" },
              { value: "medium", label: "Medium" },
              { value: "large", label: "Large" },
            ]}
          />
          <Segmented
            label="Visibility"
            value={o.opacity}
            onChange={(opacity) => set({ opacity })}
            options={[
              { value: "light", label: "Faint" },
              { value: "medium", label: "Normal" },
              { value: "strong", label: "Strong" },
            ]}
          />
          <WatermarkPreview text={o.text} layout={o.layout} size={o.size} opacity={o.opacity} />
        </div>
      );

    case "add-page-numbers":
      return (
        <div className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Position</legend>
            <div className="flex items-center gap-4">
              {/* A mini page: click where the number should go */}
              <div
                role="radiogroup"
                aria-label="Page number position"
                className="grid h-40 w-28 shrink-0 grid-cols-3 content-between rounded-md border-2 border-border bg-[#efe3c4] p-1.5 shadow-sm"
              >
                {["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"].map((pos) => {
                  const on = o.position === pos;
                  return (
                    <button
                      key={pos}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={pos.replace("-", " ")}
                      title={pos.replace("-", " ")}
                      onClick={() => set({ position: pos })}
                      className={`flex h-7 items-center justify-center rounded text-[11px] font-bold transition-colors ${
                        on ? "bg-accent text-white" : "text-gray-300 hover:bg-gray-100 hover:text-gray-500"
                      }`}
                    >
                      {on ? "1" : "●"}
                    </button>
                  );
                })}
              </div>
              <p className="text-sm text-muted">
                Click a spot on the page.
                <span className="mt-1 block font-semibold text-text capitalize">{o.position.replace("-", " ")}</span>
              </p>
            </div>
          </fieldset>
          <Segmented
            label="Style"
            value={o.format}
            onChange={(format) => set({ format })}
            options={[
              { value: "number", label: "1" },
              { value: "page", label: "Page 1" },
              { value: "of", label: "Page 1 of 9" },
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="First number"
              inputMode="numeric"
              value={o.start}
              onChange={(e) => set({ start: e.target.value.replace(/\D/g, "").slice(0, 6) })}
            />
            <Segmented
              label="Skip first page"
              value={o.skipFirst}
              onChange={(skipFirst) => set({ skipFirst })}
              options={[
                { value: "no", label: "No" },
                { value: "yes", label: "Yes" },
              ]}
            />
          </div>
        </div>
      );

    case "ocr-pdf":
      return (
        <div className="space-y-4">
          <Segmented
            label="Document language"
            value={o.language}
            onChange={(language) => set({ language })}
            options={[
              { value: "eng", label: "English" },
              { value: "hin", label: "Hindi + English" },
            ]}
          />
          <p className="rounded-lg bg-surface-2 p-3 text-xs leading-relaxed text-muted">
            Takes about 5–15 seconds per page (up to 30 pages). The pages look the same, but their text becomes searchable and selectable.
          </p>
        </div>
      );

    default:
      return null;
  }
}
