"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { openPdf, type FormField, type PdfInfo } from "@/lib/pdfPreview";
import SignatureDialog from "./SignatureDialog";
import { Spinner } from "./ui";

// ------------------------------------------------------------------- model

export type ItemKind = "text" | "image" | "whiteout" | "highlight";

/** One thing added to a page. Positions are fractions (0..1) of the page, from its top-left corner. */
export interface EditItem {
  id: string;
  page: number;
  kind: ItemKind;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  size?: number; // points
  color?: string;
  bold?: boolean;
  image?: string; // EditorImage id
}

export interface EditorImage {
  id: string;
  file: File;
  url: string;
  /** width / height */
  aspect: number;
}

export interface EditorDoc {
  items: EditItem[];
  images: EditorImage[];
  /** Form values the user changed, by field name. */
  fields: Record<string, string>;
}

export const emptyDoc: EditorDoc = { items: [], images: [], fields: {} };

/** Characters the server's built-in fonts can draw (Latin-1 plus common punctuation). */
const UNSUPPORTED = /[^\n\x20-\x7E\xA0-\xFF–—‘’‚“”„†‡•…‰€™]/;

export function hasUnsupportedText(doc: EditorDoc): boolean {
  return doc.items.some((i) => i.kind === "text" && UNSUPPORTED.test(i.text ?? ""));
}

export function changeCount(doc: EditorDoc): number {
  return doc.items.filter((i) => i.kind !== "text" || (i.text ?? "").trim()).length + Object.keys(doc.fields).length;
}

/** What the API needs: the image files in order, and the edits as JSON. */
export function toUpload(doc: EditorDoc): { files: File[]; edits: string; fields: string } {
  const used = doc.images.filter((img) => doc.items.some((i) => i.image === img.id));
  const index = new Map(used.map((img, i) => [img.id, i + 1]));
  const edits = doc.items
    .filter((i) => i.kind !== "text" || (i.text ?? "").trim())
    .map((i) => ({
      page: i.page,
      type: i.kind,
      x: round(i.x),
      y: round(i.y),
      w: round(i.w),
      h: round(i.h),
      ...(i.kind === "text" ? { text: i.text, size: i.size, color: i.color, bold: i.bold } : {}),
      ...(i.kind === "image" ? { image: index.get(i.image!) } : {}),
    }));
  return { files: used.map((u) => u.file), edits: JSON.stringify(edits), fields: JSON.stringify(doc.fields) };
}

const round = (n: number) => Math.round(n * 1e5) / 1e5;
let seq = 0;
const newId = (p: string) => `${p}${Date.now().toString(36)}${seq++}`;

const TEXT_COLORS = [
  { value: "#111111", label: "Black" },
  { value: "#1d4ed8", label: "Blue" },
  { value: "#dc2626", label: "Red" },
  { value: "#15803d", label: "Green" },
];
const SIZES = [8, 10, 12, 14, 16, 20, 24, 32, 40, 48];
const FONT = "Arial, Helvetica, 'Liberation Sans', sans-serif";

type Mode = "select" | "text" | "whiteout" | "highlight" | "place";

// ------------------------------------------------------------------ editor

export default function PdfEditor({
  file,
  doc,
  setDoc,
}: {
  file: File;
  doc: EditorDoc;
  setDoc: (update: (d: EditorDoc) => EditorDoc) => void;
}) {
  const [pdf, setPdf] = useState<PdfInfo | null>(null);
  const [sizes, setSizes] = useState<{ width: number; height: number }[]>([]);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<Mode>("select");
  const [pending, setPending] = useState<EditorImage | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [style, setStyle] = useState({ size: 14, color: TEXT_COLORS[0].value, bold: false });
  const [width, setWidth] = useState(0);
  const pagesRef = useRef<HTMLDivElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);

  // Open the PDF and read every page's size
  useEffect(() => {
    let info: PdfInfo | null = null;
    let cancelled = false;
    openPdf(file)
      .then(async (opened) => {
        info = opened;
        const all = [];
        for (let n = 1; n <= opened.pageCount; n++) all.push(await opened.pageSize(n));
        if (cancelled) return;
        setSizes(all);
        setPdf(opened);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      info?.destroy();
    };
  }, [file]);

  // Track the page width on screen, to scale text sizes
  useLayoutEffect(() => {
    const el = pagesRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [pdf]);

  const update = useCallback(
    (id: string, patch: Partial<EditItem>) => setDoc((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
    [setDoc],
  );
  const remove = useCallback(
    (id: string) => {
      setDoc((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) }));
      setSelected(null);
      setEditing(null);
    },
    [setDoc],
  );

  // Delete / Escape shortcuts (not while typing in a text box)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(null);
        setEditing(null);
        setMode("select");
        setPending(null);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selected && editing !== selected) {
        const target = e.target as HTMLElement;
        if (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
        e.preventDefault();
        remove(selected);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, editing, remove]);

  // Empty text boxes disappear when you click away from them
  useEffect(() => {
    setDoc((d) => {
      const empty = d.items.filter((i) => i.kind === "text" && i.id !== editing && !(i.text ?? "").trim());
      return empty.length ? { ...d, items: d.items.filter((i) => !empty.includes(i)) } : d;
    });
  }, [editing, setDoc]);

  function addImage(f: File, then: (img: EditorImage) => void) {
    const url = URL.createObjectURL(f);
    const probe = new Image();
    probe.onload = () => {
      const img = { id: newId("img"), file: f, url, aspect: probe.naturalWidth / probe.naturalHeight || 1 };
      setDoc((d) => ({ ...d, images: [...d.images, img] }));
      then(img);
    };
    probe.src = url;
  }

  function startPlacing(img: EditorImage) {
    setPending(img);
    setMode("place");
    setSelected(null);
    setEditing(null);
  }

  /** Click (or drag, for boxes) on a page in the current mode. */
  function onPagePointerDown(e: React.PointerEvent<HTMLDivElement>, page: number) {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    const size = sizes[page - 1];

    if (mode === "select") {
      setSelected(null);
      setEditing(null);
      return;
    }
    e.preventDefault();

    if (mode === "text") {
      const id = newId("t");
      const fontFrac = style.size / size.height;
      setDoc((d) => ({
        ...d,
        items: [...d.items, { id, page, kind: "text", x: fx, y: Math.max(0, fy - fontFrac * 0.6), w: 0, h: 0, text: "", ...style }],
      }));
      setSelected(id);
      setEditing(id);
      setMode("select");
      return;
    }

    if (mode === "place" && pending) {
      const w = Math.min(0.3, 0.9);
      const h = (w * size.width) / pending.aspect / size.height;
      const id = newId("i");
      setDoc((d) => ({
        ...d,
        items: [...d.items, { id, page, kind: "image", x: clamp(fx - w / 2, 0, 1 - w), y: clamp(fy - h / 2, 0, 1 - h), w, h, image: pending.id }],
      }));
      setSelected(id);
      setPending(null);
      setMode("select");
      return;
    }

    if (mode === "whiteout" || mode === "highlight") {
      const kind = mode;
      const id = newId("b");
      const defaultW = 0.25;
      const defaultH = kind === "highlight" ? 0.025 : 0.04;
      setDoc((d) => ({ ...d, items: [...d.items, { id, page, kind, x: fx, y: fy, w: 0, h: 0 }] }));
      const el = e.currentTarget;
      const move = (ev: PointerEvent) => {
        const mx = clamp((ev.clientX - rect.left) / rect.width, 0, 1);
        const my = clamp((ev.clientY - rect.top) / rect.height, 0, 1);
        update(id, { x: Math.min(fx, mx), y: Math.min(fy, my), w: Math.abs(mx - fx), h: Math.abs(my - fy) });
      };
      const up = (ev: PointerEvent) => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        const mx = (ev.clientX - rect.left) / rect.width;
        const my = (ev.clientY - rect.top) / rect.height;
        // A plain click makes a box of the default size
        if (Math.abs(mx - fx) < 0.01 && Math.abs(my - fy) < 0.01) {
          update(id, { x: clamp(fx - defaultW / 2, 0, 1 - defaultW), y: clamp(fy - defaultH / 2, 0, 1 - defaultH), w: defaultW, h: defaultH });
        }
        setSelected(id);
        setMode("select");
      };
      el.setPointerCapture(e.pointerId);
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
    }
  }

  const selectedItem = doc.items.find((i) => i.id === selected) ?? null;

  function setTextStyle(patch: Partial<typeof style>) {
    setStyle((s) => ({ ...s, ...patch }));
    if (selectedItem?.kind === "text") update(selectedItem.id, patch);
  }

  if (failed) {
    return <p className="rounded-xl bg-danger-soft p-4 text-sm text-danger">This PDF couldn&apos;t be opened for editing. It may be damaged.</p>;
  }
  if (!pdf) {
    return <div className="flex h-64 items-center justify-center text-muted"><Spinner size={28} /></div>;
  }

  const showTextStyle = mode === "text" || selectedItem?.kind === "text";

  return (
    <div>
      {/* Toolbar */}
      <div className="sticky top-16 z-20 -mx-1 mb-4 rounded-2xl border border-border bg-surface/95 p-2 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-center gap-1.5">
          <ToolButton active={mode === "select"} onClick={() => { setMode("select"); setPending(null); }} label="Select">
            <path d="m5 3 14 7-6 2-2 6Z" />
          </ToolButton>
          <ToolButton active={mode === "text"} onClick={() => { setMode("text"); setSelected(null); setEditing(null); }} label="Text">
            <path d="M5 6V4h14v2M12 4v16M9 20h6" />
          </ToolButton>
          <ToolButton active={signing || (mode === "place" && !!pending?.file.name.startsWith("signature"))} onClick={() => setSigning(true)} label="Sign">
            <path d="M3 17c3-1 4-6 6-6s0 6 2 6 3-4 5-4 2 3 5 3M3 21h18" />
          </ToolButton>
          <ToolButton active={mode === "place" && !pending?.file.name.startsWith("signature")} onClick={() => imageInput.current?.click()} label="Image">
            <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-9 9" />
          </ToolButton>
          <ToolButton active={mode === "whiteout"} onClick={() => { setMode("whiteout"); setSelected(null); setEditing(null); }} label="White-out">
            <rect x="4" y="7" width="16" height="10" rx="1.5" fill="white" />
          </ToolButton>
          <ToolButton active={mode === "highlight"} onClick={() => { setMode("highlight"); setSelected(null); setEditing(null); }} label="Highlight">
            <path d="m9 15 6-6 3 3-6 6H9Z" /><path d="M4 20h9" />
          </ToolButton>

          {selectedItem && (
            <button
              type="button"
              onClick={() => remove(selectedItem.id)}
              className="ml-auto flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-danger hover:bg-danger-soft"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
              Delete
            </button>
          )}
        </div>

        {/* Second row keeps a fixed height so the pages never jump while you work */}
        <div className="mt-2 flex min-h-9 flex-wrap items-center gap-2 border-t border-border px-1 pt-2 text-sm">
          {showTextStyle ? (
            <>
            <label className="flex items-center gap-1.5">
              <span className="text-muted">Size</span>
              <select
                value={selectedItem?.kind === "text" ? selectedItem.size : style.size}
                onChange={(e) => setTextStyle({ size: Number(e.target.value) })}
                className="h-8 rounded-lg border border-border bg-surface px-2"
              >
                {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <div className="flex items-center gap-1" role="radiogroup" aria-label="Text colour">
              {TEXT_COLORS.map((c) => {
                const current = (selectedItem?.kind === "text" ? selectedItem.color : style.color) === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={current}
                    aria-label={c.label}
                    title={c.label}
                    onClick={() => setTextStyle({ color: c.value })}
                    className={`h-7 w-7 rounded-full border-2 ${current ? "border-accent ring-2 ring-accent/30" : "border-border"}`}
                    style={{ background: c.value }}
                  />
                );
              })}
            </div>
            <button
              type="button"
              aria-pressed={selectedItem?.kind === "text" ? !!selectedItem.bold : style.bold}
              onClick={() => setTextStyle({ bold: !(selectedItem?.kind === "text" ? selectedItem.bold : style.bold) })}
              className="h-8 w-8 rounded-lg border border-border font-bold aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent"
            >
              B
            </button>
          </>
          ) : (
            <p className="text-xs text-muted" aria-live="polite">{hint(mode, pending, selectedItem)}</p>
          )}
        </div>
      </div>

      <input
        ref={imageInput}
        type="file"
        accept="image/png,image/jpeg,.png,.jpg,.jpeg"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) addImage(f, startPlacing);
        }}
      />

      {/* Pages */}
      <div ref={pagesRef} className="mx-auto max-w-3xl space-y-6">
        {sizes.map((size, i) => (
          <EditorPage
            key={i}
            n={i + 1}
            pdf={pdf}
            size={size}
            scale={width / size.width}
            mode={mode}
            doc={doc}
            selected={selected}
            editing={editing}
            onPointerDown={onPagePointerDown}
            onSelect={(id) => { setSelected(id); setEditing(null); }}
            onEdit={(id) => { setSelected(id); setEditing(id); }}
            update={update}
            setField={(name, value) => setDoc((d) => ({ ...d, fields: { ...d.fields, [name]: value } }))}
          />
        ))}
      </div>

      {signing && (
        <SignatureDialog
          onClose={() => setSigning(false)}
          onDone={(f) => {
            setSigning(false);
            addImage(f, startPlacing);
          }}
        />
      )}
    </div>
  );
}

function hint(mode: Mode, pending: EditorImage | null, selected: EditItem | null): string {
  if (mode === "text") return "Click on the page where the text should go.";
  if (mode === "place" && pending) return "Click on the page to place it. You can move and resize it afterwards.";
  if (mode === "whiteout") return "Drag over what you want to hide, or click to add a box.";
  if (mode === "highlight") return "Drag over the text you want to highlight.";
  if (selected?.kind === "text") return "Type to change the text. Drag the handle to move it.";
  if (selected) return "Drag to move. Drag the corner to resize. Press Delete to remove.";
  return "Choose a tool above, or click an item to change it.";
}

function ToolButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors ${
        active ? "bg-accent text-white" : "text-text hover:bg-surface-2"
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
      <span className="hidden sm:inline">{label}</span>
      <span className="sr-only sm:hidden">{label}</span>
    </button>
  );
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// -------------------------------------------------------------------- page

function EditorPage({
  n, pdf, size, scale, mode, doc, selected, editing, onPointerDown, onSelect, onEdit, update, setField,
}: {
  n: number;
  pdf: PdfInfo;
  size: { width: number; height: number };
  scale: number;
  mode: Mode;
  doc: EditorDoc;
  selected: string | null;
  editing: string | null;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>, page: number) => void;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  update: (id: string, patch: Partial<EditItem>) => void;
  setField: (name: string, value: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);

  // Render the page (and read its form fields) only when it scrolls near the screen
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let done = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (done || !entries.some((e) => e.isIntersecting)) return;
        done = true;
        io.disconnect();
        pdf.thumbnail(n, Math.min(1000, el.clientWidth || 800)).then(setSrc).catch(() => {});
        pdf.fields(n).then(setFields).catch(() => {});
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [pdf, n]);

  const items = doc.items.filter((i) => i.page === n);
  const cursor = mode === "text" ? "cursor-text" : mode === "select" ? "" : "cursor-crosshair";

  return (
    <div>
      <div
        ref={ref}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.pageBg) onPointerDown(e, n);
        }}
        className={`relative w-full touch-pan-y overflow-hidden rounded-sm bg-white shadow-card select-none ${cursor}`}
        style={{ aspectRatio: `${size.width} / ${size.height}` }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`Page ${n}`} data-page-bg="1" draggable={false} className="absolute inset-0 h-full w-full" />
        ) : (
          <div data-page-bg="1" className="absolute inset-0 flex items-center justify-center text-gray-400"><Spinner size={24} /></div>
        )}

        {fields.map((f, i) => (
          <FieldInput key={`${f.name}-${i}`} field={f} scale={scale} size={size} value={doc.fields[f.name]} onChange={(v) => setField(f.name, v)} />
        ))}

        {items.map((item) => (
          <ItemView
            key={item.id}
            item={item}
            scale={scale}
            size={size}
            image={doc.images.find((img) => img.id === item.image)}
            selected={selected === item.id}
            editing={editing === item.id}
            interactive={mode === "select"}
            onSelect={() => onSelect(item.id)}
            onEdit={() => onEdit(item.id)}
            update={(patch) => update(item.id, patch)}
          />
        ))}
      </div>
      <p className="mt-1.5 text-center text-xs text-muted">Page {n}</p>
    </div>
  );
}

// ------------------------------------------------------------------- items

function ItemView({
  item, scale, size, image, selected, editing, interactive, onSelect, onEdit, update,
}: {
  item: EditItem;
  scale: number;
  size: { width: number; height: number };
  image?: EditorImage;
  selected: boolean;
  editing: boolean;
  interactive: boolean;
  onSelect: () => void;
  onEdit: () => void;
  update: (patch: Partial<EditItem>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  /** Moves the item while the pointer is held down. */
  function drag(e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    const page = ref.current?.parentElement?.getBoundingClientRect();
    if (!page) return;
    const start = { px: e.clientX, py: e.clientY, x: item.x, y: item.y };
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      update({
        x: clamp(start.x + (ev.clientX - start.px) / page.width, -0.05, 0.98),
        y: clamp(start.y + (ev.clientY - start.py) / page.height, -0.02, 0.98),
      });
    };
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
  }

  /** Resizes boxes and images from the bottom-right corner (images keep their shape). */
  function resize(e: React.PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    const page = ref.current?.parentElement?.getBoundingClientRect();
    if (!page) return;
    const start = { px: e.clientX, py: e.clientY, w: item.w, h: item.h };
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      let w = Math.max(0.02, start.w + (ev.clientX - start.px) / page.width);
      let h = Math.max(0.01, start.h + (ev.clientY - start.py) / page.height);
      if (item.kind === "image" && image) {
        h = (w * size.width) / image.aspect / size.height;
        if (item.y + h > 1.02) {
          h = 1.02 - item.y;
          w = (h * size.height * image.aspect) / size.width;
        }
      }
      update({ w: Math.min(w, 1.02 - item.x), h });
    };
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
  }

  const ring = selected ? "outline-2 outline-offset-2 outline-accent outline-dashed" : interactive ? "hover:outline-1 hover:outline-accent/60 hover:outline-dashed" : "";
  const pointer = interactive ? "" : "pointer-events-none";

  if (item.kind === "text") {
    return (
      <div
        ref={ref}
        className={`absolute ${pointer}`}
        style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%` }}
      >
        {selected && (
          <button
            type="button"
            aria-label="Move text"
            title="Drag to move"
            onPointerDown={drag}
            className="absolute -top-7 -left-1 flex h-6 w-6 cursor-move touch-none items-center justify-center rounded-md bg-accent text-white shadow"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M12 3v18M3 12h18M12 3l-3 3m3-3 3 3M12 21l-3-3m3 3 3-3M3 12l3-3m-3 3 3 3M21 12l-3-3m3 3-3 3" /></svg>
          </button>
        )}
        <TextBox
          item={item}
          scale={scale}
          editing={editing}
          className={ring}
          onPointerDown={(e) => {
            e.stopPropagation();
            if (!editing) onEdit();
          }}
          onChange={(text) => update({ text })}
        />
      </div>
    );
  }

  const box = { left: `${item.x * 100}%`, top: `${item.y * 100}%`, width: `${item.w * 100}%`, height: `${item.h * 100}%` };
  return (
    <div
      ref={ref}
      onPointerDown={drag}
      className={`absolute touch-none ${interactive ? "cursor-move" : ""} ${pointer} ${ring}`}
      style={box}
    >
      {item.kind === "whiteout" && <div className="h-full w-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" />}
      {item.kind === "highlight" && <div className="h-full w-full bg-[#ffe066] opacity-40" />}
      {item.kind === "image" && image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.url} alt="" draggable={false} className="h-full w-full" />
      )}
      {selected && (
        <span
          role="presentation"
          onPointerDown={resize}
          className="absolute -right-2 -bottom-2 h-4 w-4 cursor-nwse-resize touch-none rounded-full border-2 border-white bg-accent shadow"
        />
      )}
    </div>
  );
}

/** Editable text with the same metrics the server uses (Arial/Helvetica, line height 1.2). */
function TextBox({
  item, scale, editing, className, onPointerDown, onChange,
}: {
  item: EditItem;
  scale: number;
  editing: boolean;
  className: string;
  onPointerDown: (e: React.PointerEvent) => void;
  onChange: (text: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // The text is set once and then owned by the browser while typing, so the caret never jumps
  useLayoutEffect(() => {
    if (ref.current && ref.current.innerText !== (item.text ?? "")) ref.current.innerText = item.text ?? "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (editing && ref.current && document.activeElement !== ref.current) {
      ref.current.focus();
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [editing]);

  const unsupported = UNSUPPORTED.test(item.text ?? "");
  return (
    <div
      ref={ref}
      role="textbox"
      aria-multiline
      aria-label="Text"
      contentEditable={editing ? "plaintext-only" : false}
      suppressContentEditableWarning
      onPointerDown={onPointerDown}
      onInput={(e) => onChange((e.currentTarget.innerText ?? "").replace(/\n$/, ""))}
      data-placeholder="Type here"
      className={`min-w-[1ch] cursor-text whitespace-pre outline-none empty:before:text-gray-400 empty:before:content-[attr(data-placeholder)] ${className} ${
        unsupported ? "bg-danger-soft" : ""
      }`}
      style={{
        fontFamily: FONT,
        fontSize: `${(item.size ?? 14) * scale}px`,
        lineHeight: 1.2,
        color: item.color,
        fontWeight: item.bold ? 700 : 400,
      }}
    />
  );
}

// -------------------------------------------------------------- form fields

function FieldInput({
  field, scale, size, value, onChange,
}: {
  field: FormField;
  scale: number;
  size: { width: number; height: number };
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  const current = value ?? field.value;
  const box = { left: `${field.x * 100}%`, top: `${field.y * 100}%`, width: `${field.w * 100}%`, height: `${field.h * 100}%` };
  const heightPx = field.h * size.height * scale;
  const fontSize = `${Math.max(9, Math.min(heightPx * 0.7, 16 * scale))}px`;
  const common = "absolute z-10 border border-blue-400/70 bg-blue-50/60 text-black outline-none focus:border-blue-600 focus:bg-white";

  if (field.kind === "checkbox") {
    return (
      <input
        type="checkbox"
        aria-label={field.name}
        checked={current === "true"}
        onChange={(e) => onChange(e.target.checked ? "true" : "false")}
        className="absolute z-10 cursor-pointer accent-blue-700"
        style={box}
      />
    );
  }
  if (field.kind === "radio") {
    return (
      <input
        type="radio"
        aria-label={`${field.name}: ${field.exportValue}`}
        checked={current === field.exportValue}
        onChange={() => onChange(field.exportValue ?? "")}
        className="absolute z-10 cursor-pointer accent-blue-700"
        style={box}
      />
    );
  }
  if (field.kind === "select") {
    return (
      <select aria-label={field.name} value={current} onChange={(e) => onChange(e.target.value)} className={common} style={{ ...box, fontSize }}>
        <option value="" />
        {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  return field.multiline ? (
    <textarea aria-label={field.name} value={current} onChange={(e) => onChange(e.target.value)} className={`${common} resize-none px-1`} style={{ ...box, fontSize }} />
  ) : (
    <input type="text" aria-label={field.name} value={current} onChange={(e) => onChange(e.target.value)} className={`${common} px-1`} style={{ ...box, fontSize }} />
  );
}
