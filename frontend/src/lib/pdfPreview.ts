// In-browser PDF previews with pdf.js (loaded lazily, only on tool pages).

type PdfJs = typeof import("pdfjs-dist");
let pdfjs: Promise<PdfJs> | null = null;

function lib(): Promise<PdfJs> {
  if (!pdfjs) {
    pdfjs = import("pdfjs-dist").then((m) => {
      m.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return m;
    });
  }
  return pdfjs;
}

export interface PdfInfo {
  pageCount: number;
  /** Renders page n (1-based) to a data URL at roughly `width` px wide. */
  thumbnail: (page: number, width?: number) => Promise<string>;
  destroy: () => void;
}

export class PasswordRequired extends Error {}

export async function openPdf(file: File): Promise<PdfInfo> {
  const { getDocument, PasswordException } = await lib();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = getDocument({ data });
  let doc;
  try {
    doc = await task.promise;
  } catch (e) {
    void task.destroy();
    if (e instanceof PasswordException) throw new PasswordRequired();
    throw e;
  }
  return {
    pageCount: doc.numPages,
    async thumbnail(n, width = 220) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (width * (window.devicePixelRatio || 1)) / base.width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport }).promise;
      const url = canvas.toDataURL("image/jpeg", 0.8);
      page.cleanup();
      return url;
    },
    destroy() {
      void task.destroy();
    },
  };
}
