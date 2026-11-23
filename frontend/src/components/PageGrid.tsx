"use client";

import { useState } from "react";
import { RotateCcwIcon, RotateCwIcon, TrashIcon } from "./Icons";
import { Spinner } from "./ui";

export interface PageItem {
  /** Original 1-based page number. */
  n: number;
  rotation: number;
  deleted: boolean;
  thumb?: string;
}

/**
 * Visual page editor. "organize" mode: reorder, rotate, delete. "rotate" mode: rotate only.
 */
export default function PageGrid({
  pages,
  mode,
  onChange,
}: {
  pages: PageItem[];
  mode: "organize" | "rotate";
  onChange: (pages: PageItem[]) => void;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const organize = mode === "organize";

  const update = (i: number, patch: Partial<PageItem>) =>
    onChange(pages.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const rotate = (i: number, by: number) => update(i, { rotation: (pages[i].rotation + by + 360) % 360 });
  const move = (from: number, to: number) => {
    const next = [...pages];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4" aria-label="Pages">
      {pages.map((p, i) => (
        <li
          key={p.n}
          draggable={organize}
          onDragStart={() => setDragging(i)}
          onDragOver={(e) => {
            if (dragging === null) return;
            e.preventDefault();
            setTarget(i);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragging !== null && dragging !== i) move(dragging, i);
            setDragging(null);
            setTarget(null);
          }}
          onDragEnd={() => {
            setDragging(null);
            setTarget(null);
          }}
          className={`group relative rounded-2xl border bg-surface p-3 shadow-card transition-all ${
            target === i && dragging !== i ? "border-accent ring-2 ring-accent/30" : "border-border"
          } ${dragging === i ? "opacity-40" : ""} ${organize ? "cursor-grab active:cursor-grabbing" : ""}`}
        >
          <button
            type="button"
            onClick={() => (organize ? p.deleted && update(i, { deleted: false }) : rotate(i, 90))}
            aria-label={organize ? (p.deleted ? `Restore page ${p.n}` : `Page ${p.n}`) : `Rotate page ${p.n} clockwise`}
            className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-surface-2"
          >
            {p.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.thumb}
                alt=""
                draggable={false}
                className={`max-h-[85%] max-w-[85%] object-contain shadow transition-transform duration-200 ${p.deleted ? "opacity-25 grayscale" : ""}`}
                style={{ transform: `rotate(${p.rotation}deg)` }}
              />
            ) : (
              <Spinner />
            )}
            {p.deleted && (
              <span className="absolute inset-x-3 bottom-3 rounded-md bg-surface px-2 py-1 text-center text-xs font-semibold text-text shadow">
                Removed · click to restore
              </span>
            )}
          </button>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2">
            <span className="text-xs font-medium whitespace-nowrap text-muted">
              Page {p.n}
              {p.rotation ? ` · ${p.rotation}°` : ""}
            </span>
            <span className="flex gap-0.5">
              <IconBtn label={`Rotate page ${p.n} left`} onClick={() => rotate(i, -90)} disabled={p.deleted}>
                <RotateCcwIcon width={16} height={16} />
              </IconBtn>
              <IconBtn label={`Rotate page ${p.n} right`} onClick={() => rotate(i, 90)} disabled={p.deleted}>
                <RotateCwIcon width={16} height={16} />
              </IconBtn>
              {organize && (
                <IconBtn
                  label={p.deleted ? `Restore page ${p.n}` : `Delete page ${p.n}`}
                  onClick={() => update(i, { deleted: !p.deleted })}
                  danger
                >
                  <TrashIcon width={16} height={16} />
                </IconBtn>
              )}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function IconBtn({
  label,
  onClick,
  children,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md p-1.5 text-muted transition-colors hover:bg-surface-2 disabled:opacity-30 ${
        danger ? "hover:text-danger" : "hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}
