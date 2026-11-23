"use client";

import { useState } from "react";
import { formatBytes } from "@/lib/api";
import { ChevronLeftIcon, ChevronRightIcon, FileIcon, LockIcon, PlusIcon, XIcon } from "./Icons";
import { Spinner } from "./ui";

export interface FileItem {
  id: string;
  file: File;
  thumb?: string;
  pages?: number;
  locked?: boolean;
  unreadable?: boolean;
  /** Set for documents that can't be previewed (DOCX, XLSX…): the file type label. */
  docType?: string;
}

/** Uploaded files as cards. Drag (or use the arrows) to reorder when order matters. */
export default function FileGrid({
  items,
  sortable,
  onReorder,
  onRemove,
  onAdd,
}: {
  items: FileItem[];
  sortable: boolean;
  onReorder: (from: number, to: number) => void;
  onRemove: (id: string) => void;
  onAdd?: () => void;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" aria-label="Selected files">
      {items.map((item, i) => (
        <li
          key={item.id}
          draggable={sortable}
          onDragStart={(e) => {
            setDragging(i);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            if (dragging === null) return;
            e.preventDefault();
            setTarget(i);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragging !== null && dragging !== i) onReorder(dragging, i);
            setDragging(null);
            setTarget(null);
          }}
          onDragEnd={() => {
            setDragging(null);
            setTarget(null);
          }}
          className={`group relative flex flex-col rounded-2xl border bg-surface p-3 shadow-card transition-all ${
            target === i && dragging !== i ? "border-accent ring-2 ring-accent/30" : "border-border"
          } ${dragging === i ? "opacity-40" : ""} ${sortable ? "cursor-grab active:cursor-grabbing" : ""}`}
        >
          <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg bg-surface-2">
            {item.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.thumb} alt="" className="max-h-full max-w-full object-contain shadow-sm" draggable={false} />
            ) : item.locked ? (
              <LockIcon width={36} height={36} className="text-muted" />
            ) : item.docType ? (
              <span className="flex flex-col items-center gap-2 text-muted">
                <FileIcon width={44} height={44} />
                <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-bold text-white">{item.docType}</span>
              </span>
            ) : item.unreadable ? (
              <FileIcon width={36} height={36} className="text-muted" />
            ) : (
              <Spinner size={24} />
            )}
            {sortable && (
              <span className="absolute top-2 left-2 rounded-full bg-text/75 px-2 py-0.5 text-xs font-semibold text-bg">{i + 1}</span>
            )}
          </div>
          <p className="mt-2 truncate text-sm font-medium" title={item.file.name}>{item.file.name}</p>
          <p className="text-xs text-muted">
            {formatBytes(item.file.size)}
            {item.pages ? ` · ${item.pages} ${item.pages === 1 ? "page" : "pages"}` : ""}
            {item.locked ? " · password-protected" : ""}
          </p>

          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label={`Remove ${item.file.name}`}
            className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-sm hover:text-danger"
          >
            <XIcon width={14} height={14} />
          </button>

          {sortable && items.length > 1 && (
            <div className="mt-2 flex justify-between opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <button
                type="button"
                disabled={i === 0}
                onClick={() => onReorder(i, i - 1)}
                aria-label={`Move ${item.file.name} earlier`}
                className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-text disabled:invisible"
              >
                <ChevronLeftIcon width={18} height={18} />
              </button>
              <button
                type="button"
                disabled={i === items.length - 1}
                onClick={() => onReorder(i, i + 1)}
                aria-label={`Move ${item.file.name} later`}
                className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-text disabled:invisible"
              >
                <ChevronRightIcon width={18} height={18} />
              </button>
            </div>
          )}
        </li>
      ))}
      {onAdd && (
        <li>
          <button
            type="button"
            onClick={onAdd}
            className="flex h-full min-h-48 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
          >
            <PlusIcon />
            Add more
          </button>
        </li>
      )}
    </ul>
  );
}
