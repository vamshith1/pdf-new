"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";

type Tab = "draw" | "type" | "upload";

const INKS = [
  { value: "#111111", label: "Black" },
  { value: "#1d3fae", label: "Blue" },
];
const SCRIPT = "'Segoe Script', 'Brush Script MT', 'Lucida Handwriting', 'Apple Chancery', cursive";

/** Lets the user draw, type or upload a signature, and returns it as an image file. */
export default function SignatureDialog({ onClose, onDone }: { onClose: () => void; onDone: (file: File) => void }) {
  const [tab, setTab] = useState<Tab>("draw");
  const [ink, setInk] = useState(INKS[0].value);
  const [name, setName] = useState("");
  const [drawn, setDrawn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const inkRef = useRef(ink);
  useEffect(() => {
    inkRef.current = ink;
  }, [ink]);

  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    return () => d?.close();
  }, []);

  // Drawing with mouse, pen or finger
  useEffect(() => {
    const c = canvas.current;
    if (!c || tab !== "draw") return;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.clientWidth * ratio;
    c.height = c.clientHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setDrawn(false);
    let last: { x: number; y: number } | null = null;
    const point = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const down = (e: PointerEvent) => {
      c.setPointerCapture(e.pointerId);
      last = point(e);
    };
    const move = (e: PointerEvent) => {
      if (!last) return;
      const p = point(e);
      ctx.strokeStyle = inkRef.current;
      ctx.lineWidth = e.pressure && e.pointerType === "pen" ? 1.5 + e.pressure * 2.5 : 2.6;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
      setDrawn(true);
    };
    const up = () => {
      last = null;
    };
    c.addEventListener("pointerdown", down);
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);
    return () => {
      c.removeEventListener("pointerdown", down);
      c.removeEventListener("pointermove", move);
      c.removeEventListener("pointerup", up);
      c.removeEventListener("pointercancel", up);
    };
  }, [tab]);


  function clear() {
    const c = canvas.current;
    if (!c) return;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setDrawn(false);
  }

  async function finish() {
    setError(null);
    if (tab === "draw") {
      const c = canvas.current;
      if (!c || !drawn) return setError("Draw your signature first.");
      const png = await trimmedPng(c);
      if (!png) return setError("Draw your signature first.");
      onDone(new File([png], "signature.png", { type: "image/png" }));
    } else if (tab === "type") {
      if (!name.trim()) return setError("Type your name first.");
      await document.fonts?.ready;
      const c = document.createElement("canvas");
      const size = 96;
      const ctx = c.getContext("2d")!;
      ctx.font = `${size}px ${SCRIPT}`;
      const width = Math.ceil(ctx.measureText(name.trim()).width) + size;
      c.width = width;
      c.height = Math.ceil(size * 1.8);
      ctx.font = `${size}px ${SCRIPT}`;
      ctx.fillStyle = ink;
      ctx.textBaseline = "middle";
      ctx.fillText(name.trim(), size / 2, c.height / 2);
      const png = await trimmedPng(c);
      if (!png) return setError("Type your name first.");
      onDone(new File([png], "signature.png", { type: "image/png" }));
    }
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && onClose()}
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-3xl border border-border bg-surface p-0 text-text shadow-2xl backdrop:bg-black/50"
    >
      <div className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add your signature</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-text">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div role="tablist" className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1 text-sm font-semibold">
          {(["draw", "type", "upload"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => { setTab(t); setError(null); }}
              className="rounded-lg py-2 capitalize text-muted aria-selected:bg-surface aria-selected:text-text aria-selected:shadow-sm"
            >
              {t}
            </button>
          ))}
        </div>

        {tab !== "upload" && (
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="text-muted">Ink</span>
            {INKS.map((c) => (
              <button
                key={c.value}
                type="button"
                aria-label={c.label}
                aria-pressed={ink === c.value}
                onClick={() => setInk(c.value)}
                className={`h-7 w-7 rounded-full border-2 ${ink === c.value ? "border-accent ring-2 ring-accent/30" : "border-border"}`}
                style={{ background: c.value }}
              />
            ))}
          </div>
        )}

        {tab === "draw" && (
          <div className="mt-3">
            <canvas ref={canvas} className="h-44 w-full touch-none rounded-xl border-2 border-dashed border-border bg-white" aria-label="Signature drawing area" />
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <span>Sign with your mouse, finger or pen.</span>
              <button type="button" onClick={clear} className="font-semibold text-accent hover:underline">Clear</button>
            </div>
          </div>
        )}

        {tab === "type" && (
          <div className="mt-3">
            <input
              autoFocus
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="h-11 w-full rounded-xl border border-border bg-surface px-3 outline-none focus:border-accent"
            />
            <div className="mt-3 flex h-28 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-white px-4">
              <span className="truncate text-5xl" style={{ fontFamily: SCRIPT, color: ink }}>{name || "Your name"}</span>
            </div>
          </div>
        )}

        {tab === "upload" && (
          <label className="mt-4 flex h-44 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface-2 text-center text-sm text-muted hover:border-accent">
            <span className="font-semibold text-text">Choose a photo of your signature</span>
            <span className="mt-1">PNG or JPG. A clear photo on white paper works best.</span>
            <input
              type="file"
              accept="image/png,image/jpeg,.png,.jpg,.jpeg"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const ext = f.type === "image/png" ? "png" : "jpg";
                onDone(new File([f], `signature-upload.${ext}`, { type: f.type }));
              }}
            />
          </label>
        )}

        {error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}

        {tab !== "upload" && (
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={finish}>Use signature</Button>
          </div>
        )}
      </div>
    </dialog>
  );
}

/** Crops the canvas to what was drawn (plus a little margin) and returns a transparent PNG. */
async function trimmedPng(source: HTMLCanvasElement): Promise<Blob | null> {
  const ctx = source.getContext("2d")!;
  const { width, height } = source;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const pad = 6;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext("2d")!.drawImage(source, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return new Promise((resolve) => out.toBlob(resolve, "image/png"));
}
