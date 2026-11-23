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
    default:
      return { ...o };
  }
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

    default:
      return null;
  }
}
