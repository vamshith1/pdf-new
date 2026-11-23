"use client";

import { useRef, useState, type ReactNode } from "react";
import { UploadIcon } from "./Icons";

/** Accepts a file if its MIME type or extension appears in the accept string. */
export function matchesAccept(file: File, accept: string): boolean {
  const name = file.name.toLowerCase();
  return accept.split(",").some((a) => {
    a = a.trim().toLowerCase();
    return a.startsWith(".") ? name.endsWith(a) : file.type === a;
  });
}

export function useFilePicker(accept: string, multiple: boolean, onFiles: (files: File[]) => void) {
  const input = useRef<HTMLInputElement>(null);
  const element = (
    <input
      ref={input}
      type="file"
      accept={accept}
      multiple={multiple}
      className="hidden"
      onChange={(e) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = "";
        if (files.length) onFiles(files);
      }}
    />
  );
  return { open: () => input.current?.click(), element };
}

export default function Dropzone({
  accept,
  acceptLabel,
  multiple,
  onFiles,
  children,
}: {
  accept: string;
  acceptLabel: string;
  multiple: boolean;
  onFiles: (files: File[]) => void;
  children?: ReactNode;
}) {
  const [over, setOver] = useState(false);
  const picker = useFilePicker(accept, multiple, onFiles);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(files);
      }}
      className={`flex flex-col items-center rounded-3xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
        over ? "border-accent bg-accent-soft" : "border-border bg-surface"
      }`}
    >
      {picker.element}
      <button
        type="button"
        onClick={picker.open}
        className="inline-flex h-14 items-center gap-3 rounded-2xl bg-accent px-8 text-lg font-semibold text-white shadow-md transition-colors hover:bg-accent-hover"
      >
        <UploadIcon />
        Choose {multiple ? "files" : "file"}
      </button>
      <p className="mt-4 text-sm text-muted">or drop {acceptLabel} here</p>
      {children}
    </div>
  );
}
