"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError, deleteJob, downloadUrl, formatBytes, startJob, waitForJob, type JobView,
} from "@/lib/api";
import { clearHandoff, peekHandoff, setHandoff } from "@/lib/handoff";
import { openPdf, PasswordRequired, type PdfInfo } from "@/lib/pdfPreview";
import { toolBySlug, type Tool } from "@/lib/tools";
import Dropzone, { matchesAccept, useFilePicker } from "./Dropzone";
import FileGrid, { type FileItem } from "./FileGrid";
import { AlertIcon, ArrowRightIcon, CheckIcon, ClockIcon, DownloadIcon, RotateCcwIcon, RotateCwIcon, ShieldIcon, TrashIcon } from "./Icons";
import PageGrid, { type PageItem } from "./PageGrid";
import { ToolTile } from "./ToolCard";
import ToolOptions, { defaultOptions, toApiOptions, validate, type Options } from "./ToolOptions";
import { Button, Spinner } from "./ui";

type Phase =
  | { name: "select" }
  | { name: "edit" }
  | { name: "uploading"; progress: number }
  | { name: "processing" }
  | { name: "done"; job: JobView }
  | { name: "error"; message: string };

let nextId = 0;
const MAX_PREVIEW_PAGES = 200;

export default function Workspace({ tool }: { tool: Tool }) {
  const router = useRouter();
  const pageMode = tool.slug === "organize-pdf" || tool.slug === "rotate-pdf";

  const [phase, setPhase] = useState<Phase>({ name: "select" });
  const [items, setItems] = useState<FileItem[]>([]);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [options, setOptions] = useState<Options>(defaultOptions[tool.slug]);
  const [notice, setNotice] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const pdfDoc = useRef<PdfInfo | null>(null);

  // ------------------------------------------------------------------ files

  const addFiles = useCallback(
    (incoming: File[]) => {
      const accepted = incoming.filter((f) => matchesAccept(f, tool.accept));
      const rejected = incoming.length - accepted.length;
      setNotice(rejected ? `${rejected} file${rejected > 1 ? "s were" : " was"} skipped: ${tool.name} accepts ${tool.acceptLabel}.` : null);
      if (!accepted.length) return;

      const chosen = tool.multiple ? accepted : accepted.slice(0, 1);
      const newItems = chosen.map((file) => ({ id: `f${nextId++}`, file }));
      setItems((prev) => (tool.multiple ? [...prev, ...newItems] : newItems));
      setPhase({ name: "edit" });

      for (const item of newItems) {
        if (item.file.type.startsWith("image/") || !item.file.name.toLowerCase().endsWith(".pdf")) {
          const thumb = URL.createObjectURL(item.file);
          setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, thumb } : p)));
          continue;
        }
        openPdf(item.file)
          .then(async (info) => {
            const thumb = await info.thumbnail(1);
            setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, thumb, pages: info.pageCount } : p)));
            if (pageMode) {
              pdfDoc.current?.destroy();
              pdfDoc.current = info;
              loadPages(info);
            } else {
              info.destroy();
            }
          })
          .catch((e) => {
            const locked = e instanceof PasswordRequired;
            setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, locked, unreadable: !locked } : p)));
          });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tool],
  );

  function loadPages(info: PdfInfo) {
    const count = Math.min(info.pageCount, MAX_PREVIEW_PAGES);
    setPages(Array.from({ length: count }, (_, i) => ({ n: i + 1, rotation: 0, deleted: false })));
    (async () => {
      for (let n = 1; n <= count; n++) {
        if (pdfDoc.current !== info) return; // a different file was chosen
        const thumb = await info.thumbnail(n, 160);
        setPages((prev) => prev.map((p) => (p.n === n ? { ...p, thumb } : p)));
      }
    })();
  }

  // Pick up a file handed over from a previous tool ("Continue with …")
  useEffect(() => {
    const file = peekHandoff();
    if (!file) return;
    const timer = setTimeout(() => {
      clearHandoff();
      addFiles([file]);
    }, 0);
    return () => clearTimeout(timer);
  }, [addFiles]);

  // Bring the progress/result card into view if the user had scrolled down
  useEffect(() => {
    if (phase.name === "edit" || phase.name === "select") return;
    const el = document.getElementById("workspace");
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [phase.name]);

  // Stop uploads and free pdf.js memory when leaving the page
  useEffect(() => () => {
    pdfDoc.current?.destroy();
    abort.current?.abort();
  }, []);

  const picker = useFilePicker(tool.accept, tool.multiple, addFiles);

  const removeItem = (id: string) => {
    const left = items.filter((i) => i.id !== id);
    setItems(left);
    if (!left.length) reset();
  };

  const reorder = (from: number, to: number) =>
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });

  function reset() {
    abort.current?.abort();
    pdfDoc.current?.destroy();
    pdfDoc.current = null;
    setItems([]);
    setPages([]);
    setOptions(defaultOptions[tool.slug]);
    setNotice(null);
    setPhase({ name: "select" });
  }

  // ---------------------------------------------------------------- run job

  const pageCount = items[0]?.pages;
  const locked = items.some((i) => i.locked) && tool.slug !== "unlock-pdf";
  const kept = pages.filter((p) => !p.deleted);

  let blocker: string | null = validate(tool.slug, options, pageCount);
  if (items.length < tool.minFiles) blocker = `Add at least ${tool.minFiles} files.`;
  else if (locked) blocker = "A file is password-protected. Unlock it first.";
  else if (pageMode && pageCount && pageCount > MAX_PREVIEW_PAGES) blocker = `Page editing supports PDFs up to ${MAX_PREVIEW_PAGES} pages.`;
  else if (pageMode && pages.length && !kept.length) blocker = "Keep at least one page.";
  else if (tool.slug === "rotate-pdf" && pages.length && !pages.some((p) => p.rotation)) blocker = "Rotate at least one page.";
  else if (pageMode && !pages.length) blocker = "Loading pages…";

  async function run() {
    if (blocker) return;
    const controller = new AbortController();
    abort.current = controller;
    const apiOptions =
      tool.slug === "rotate-pdf"
        ? { rotations: pages.map((p) => p.rotation).join(",") }
        : tool.slug === "organize-pdf"
          ? { order: kept.map((p) => p.n).join(","), rotations: kept.map((p) => p.rotation).join(",") }
          : toApiOptions(tool.slug, options);
    try {
      setPhase({ name: "uploading", progress: 0 });
      const job = await startJob(tool.apiId, items.map((i) => i.file), apiOptions,
        (progress) => setPhase({ name: "uploading", progress }), controller.signal);
      setPhase({ name: "processing" });
      const finished = await waitForJob(job.id, controller.signal);
      if (finished.status === "FAILED") setPhase({ name: "error", message: finished.error ?? "Processing failed." });
      else setPhase({ name: "done", job: finished });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setPhase({ name: "edit" });
        return;
      }
      setPhase({ name: "error", message: e instanceof ApiError ? e.message : "Something went wrong. Please try again." });
    }
  }

  // ----------------------------------------------------------------- render

  if (phase.name === "select") {
    return (
      <Dropzone accept={tool.accept} acceptLabel={tool.acceptLabel} multiple={tool.multiple} onFiles={addFiles}>
        {notice && <p className="mt-4 text-sm text-danger">{notice}</p>}
        <p className="mt-8 flex items-center gap-2 text-xs text-muted">
          <ShieldIcon width={16} height={16} /> Files are encrypted in transit and deleted automatically within an hour.
        </p>
      </Dropzone>
    );
  }

  if (phase.name === "uploading" || phase.name === "processing") {
    const pct = phase.name === "uploading" ? Math.round(phase.progress * 100) : 100;
    return (
      <Panel>
        <div className="flex flex-col items-center py-10 text-center" role="status" aria-live="polite">
          <div className="text-accent"><Spinner size={44} /></div>
          <h2 className="mt-6 text-xl font-semibold">{phase.name === "uploading" ? "Uploading…" : `Working on your ${tool.slug === "jpg-to-pdf" ? "images" : "PDF"}…`}</h2>
          <div className="mt-5 h-2 w-full max-w-sm overflow-hidden rounded-full bg-surface-2">
            <div
              className={`h-full rounded-full bg-accent transition-all ${phase.name === "processing" ? "animate-pulse" : ""}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-muted">{phase.name === "uploading" ? `${pct}%` : "This usually takes a few seconds."}</p>
          <Button variant="ghost" size="sm" className="mt-6" onClick={() => abort.current?.abort()}>Cancel</Button>
        </div>
      </Panel>
    );
  }

  if (phase.name === "done") return <Result tool={tool} job={phase.job} onRestart={reset} router={router} />;

  if (phase.name === "error") {
    return (
      <Panel>
        <div className="flex flex-col items-center py-10 text-center" role="alert">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft text-danger"><AlertIcon /></span>
          <h2 className="mt-5 text-xl font-semibold">That didn&apos;t work</h2>
          <p className="mt-2 max-w-md text-muted">{phase.message}</p>
          <div className="mt-6 flex gap-3">
            <Button onClick={() => setPhase({ name: "edit" })}>Back to my files</Button>
            <Button variant="secondary" onClick={reset}>Start over</Button>
          </div>
        </div>
      </Panel>
    );
  }

  // phase: edit
  const hasOptions = !pageMode && !["merge-pdf"].includes(tool.slug);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section aria-label="Files" className="min-w-0">
        {picker.element}
        {notice && <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{notice}</p>}
        {pageMode ? (
          <>
            {tool.slug === "rotate-pdf" && (
              <div className="mb-4 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => setPages(pages.map((p) => ({ ...p, rotation: (p.rotation + 270) % 360 })))}>
                  <RotateCcwIcon width={16} height={16} /> Rotate all left
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setPages(pages.map((p) => ({ ...p, rotation: (p.rotation + 90) % 360 })))}>
                  <RotateCwIcon width={16} height={16} /> Rotate all right
                </Button>
                {pages.some((p) => p.rotation) && (
                  <Button variant="ghost" size="sm" onClick={() => setPages(pages.map((p) => ({ ...p, rotation: 0 })))}>Reset</Button>
                )}
              </div>
            )}
            {items[0]?.locked ? (
              <LockedNotice />
            ) : pages.length ? (
              <PageGrid pages={pages} mode={tool.slug === "rotate-pdf" ? "rotate" : "organize"} onChange={setPages} />
            ) : (
              <div className="flex h-64 items-center justify-center text-muted"><Spinner size={28} /></div>
            )}
          </>
        ) : (
          <>
            <FileGrid
              items={items}
              sortable={tool.multiple}
              onReorder={reorder}
              onRemove={removeItem}
              onAdd={tool.multiple ? picker.open : undefined}
            />
            {locked && <div className="mt-4"><LockedNotice /></div>}
          </>
        )}
      </section>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Panel>
          <div className="flex items-center gap-3">
            <ToolTile tool={tool} size={36} />
            <h2 className="text-lg font-semibold">{tool.name}</h2>
          </div>
          <div className="mt-5">
            {hasOptions ? (
              <ToolOptions slug={tool.slug} options={options} set={(patch) => setOptions((o) => ({ ...o, ...patch }))} pageCount={pageCount} />
            ) : (
              <SummaryText tool={tool} items={items} pages={pages} />
            )}
          </div>
          <Button size="lg" className="mt-6 w-full" disabled={!!blocker} onClick={run}>
            {tool.action} <ArrowRightIcon width={18} height={18} />
          </Button>
          {blocker && <p className="mt-2 text-center text-xs text-muted">{blocker}</p>}
          <button type="button" onClick={reset} className="mt-4 w-full text-center text-sm text-muted hover:text-text">
            {pageMode || !tool.multiple ? "Choose a different file" : "Remove all files"}
          </button>
        </Panel>
      </aside>
    </div>
  );
}

function SummaryText({ tool, items, pages }: { tool: Tool; items: FileItem[]; pages: PageItem[] }) {
  if (tool.slug === "merge-pdf") {
    const total = items.reduce((n, i) => n + (i.pages ?? 0), 0);
    return (
      <p className="text-sm leading-relaxed text-muted">
        {items.length < 2 ? "Add at least one more PDF. " : `${items.length} files${total ? `, ${total} pages in total` : ""}. `}
        Files are merged in the order shown. Drag them to change it.
      </p>
    );
  }
  const removed = pages.filter((p) => p.deleted).length;
  const rotated = pages.filter((p) => !p.deleted && p.rotation).length;
  if (tool.slug === "rotate-pdf") {
    return <p className="text-sm text-muted">{rotated ? `${rotated} of ${pages.length} pages will be rotated.` : "Click a page to rotate it, or use Rotate all."}</p>;
  }
  return (
    <ul className="space-y-1 text-sm text-muted">
      <li>{pages.length - removed} pages kept{removed ? `, ${removed} removed` : ""}</li>
      {rotated > 0 && <li>{rotated} rotated</li>}
      <li className="pt-2 text-xs">Drag pages to reorder. Use the buttons under each page to rotate or delete it.</li>
    </ul>
  );
}

function LockedNotice() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-sm">
      <span className="text-danger"><AlertIcon width={20} height={20} /></span>
      <span>
        This PDF is password-protected.{" "}
        <Link href="/unlock-pdf" className="font-semibold text-accent hover:underline">Unlock it first</Link>, then come back.
      </span>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-border bg-surface p-6 shadow-card">{children}</div>;
}

// --------------------------------------------------------------------- result

function Result({
  tool, job, onRestart, router,
}: { tool: Tool; job: JobView; onRestart: () => void; router: ReturnType<typeof useRouter> }) {
  const [deleted, setDeleted] = useState(false);
  const [continuing, setContinuing] = useState<string | null>(null);
  const result = job.result!;
  const stats = result.stats ?? {};
  const isPdf = result.filename.toLowerCase().endsWith(".pdf");
  const expiresAt = new Date(job.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  async function continueWith(slug: Tool["slug"]) {
    setContinuing(slug);
    try {
      const blob = await (await fetch(downloadUrl(job))).blob();
      setHandoff(new File([blob], result.filename, { type: "application/pdf" }));
      router.push(`/${slug}`);
    } catch {
      setContinuing(null);
    }
  }

  let headline = "Your file is ready";
  let detail: string | null = null;
  if (tool.slug === "compress-pdf") {
    const saved = Number(stats.savedPercent ?? 0);
    headline = saved > 0 ? `Your PDF is now ${saved}% smaller` : "Your PDF was already well optimised";
    detail = `${formatBytes(Number(stats.originalSize))} → ${formatBytes(Number(stats.compressedSize ?? result.size))}`;
    if (saved === 0) detail = "We couldn't make it smaller without losing quality, so you get the original back.";
  } else if (tool.slug === "merge-pdf") {
    headline = "Your PDFs have been merged";
    detail = `${stats.files} files · ${stats.pages} pages`;
  } else if (tool.slug === "split-pdf") {
    headline = "Your PDF has been split";
    detail = `${stats.files} ${Number(stats.files) === 1 ? "file" : "files"}`;
  } else if (tool.slug === "pdf-to-jpg") {
    headline = "Your images are ready";
    detail = `${stats.images} ${Number(stats.images) === 1 ? "image" : "images"} at ${stats.dpi} DPI`;
  } else if (tool.slug === "protect-pdf") {
    headline = "Your PDF is protected";
    detail = "AES-256 encryption. The password is needed to open it.";
  } else if (tool.slug === "unlock-pdf") {
    headline = "Your PDF is unlocked";
    detail = "The password and restrictions have been removed.";
  } else if (tool.slug === "jpg-to-pdf") {
    headline = "Your images are now a PDF";
    detail = `${stats.pages} ${Number(stats.pages) === 1 ? "page" : "pages"}`;
  } else if (tool.slug === "rotate-pdf") {
    headline = "Your PDF has been rotated";
    detail = `${stats.pages} ${Number(stats.pages) === 1 ? "page" : "pages"} rotated`;
  } else if (tool.slug === "organize-pdf") {
    headline = "Your PDF has been reorganised";
    detail = `${stats.pages} pages${Number(stats.removed) ? `, ${stats.removed} removed` : ""}`;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-3xl border border-border bg-surface p-8 text-center shadow-card">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success"><CheckIcon /></span>
        <h2 className="mt-5 text-2xl font-semibold">{headline}</h2>
        {detail && <p className="mt-2 text-muted">{detail}</p>}

        {deleted ? (
          <p className="mt-8 rounded-xl bg-surface-2 p-4 text-sm">Your files have been deleted from our servers.</p>
        ) : (
          <>
            <a
              href={downloadUrl(job)}
              download={result.filename}
              className="mt-8 inline-flex h-14 items-center gap-3 rounded-2xl bg-accent px-8 text-lg font-semibold text-white shadow-md transition-colors hover:bg-accent-hover"
            >
              <DownloadIcon /> Download {isPdf ? "PDF" : result.filename.endsWith(".zip") ? "ZIP" : "file"}
            </a>
            <p className="mt-3 truncate text-sm text-muted">{result.filename} · {formatBytes(result.size)}</p>
          </>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-border pt-5 text-sm text-muted">
          {!deleted && (
            <>
              <span className="flex items-center gap-1.5"><ClockIcon width={16} height={16} /> Deleted automatically at {expiresAt}</span>
              <button
                type="button"
                className="flex items-center gap-1.5 font-medium text-danger hover:underline"
                onClick={async () => {
                  await deleteJob(job.id);
                  setDeleted(true);
                }}
              >
                <TrashIcon width={16} height={16} /> Delete now
              </button>
            </>
          )}
          <button type="button" onClick={onRestart} className="font-medium text-accent hover:underline">
            {tool.name} another file
          </button>
        </div>
      </div>

      {isPdf && !deleted && tool.next.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-muted">Continue with this file</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {tool.next.map((slug) => {
              const next = toolBySlug[slug];
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => continueWith(slug)}
                  disabled={!!continuing}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-left shadow-card transition-colors hover:border-accent/50 disabled:opacity-60"
                >
                  <ToolTile tool={next} size={36} />
                  <span className="text-sm font-semibold">{next.name}</span>
                  {continuing === slug && <span className="ml-auto text-accent"><Spinner size={16} /></span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
