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

/** A fillable form field on a page. Position and size are fractions (0..1) of the page as displayed. */
export interface FormField {
  name: string;
  kind: "text" | "checkbox" | "radio" | "select";
  x: number;
  y: number;
  w: number;
  h: number;
  /** Current value: text, chosen option, or for checkboxes "true"/"false". */
  value: string;
  /** For radio buttons: the value this button stands for. */
  exportValue?: string;
  options?: { value: string; label: string }[];
  multiline?: boolean;
}

export interface PdfInfo {
  pageCount: number;
  /** Renders page n (1-based) to a data URL at roughly `width` px wide. */
  thumbnail: (page: number, width?: number) => Promise<string>;
  /** Page size in points as displayed (rotation applied). */
  pageSize: (page: number) => Promise<{ width: number; height: number }>;
  /** Fillable form fields on page n. */
  fields: (page: number) => Promise<FormField[]>;
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
    async pageSize(n) {
      const page = await doc.getPage(n);
      const { width, height } = page.getViewport({ scale: 1 });
      return { width, height };
    },
    async fields(n) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const annotations: any[] = await page.getAnnotations({ intent: "display" });
      const out: FormField[] = [];
      for (const a of annotations) {
        if (a.subtype !== "Widget" || !a.fieldName || a.readOnly || a.hidden || a.pushButton) continue;
        // Map the field's corners from PDF space to the displayed page (handles rotation)
        const [ta, tb, tc, td, te, tf] = viewport.transform;
        const map = (x: number, y: number) => [ta * x + tc * y + te, tb * x + td * y + tf];
        const [x1, y1] = map(a.rect[0], a.rect[1]);
        const [x2, y2] = map(a.rect[2], a.rect[3]);
        const box = {
          x: Math.min(x1, x2) / viewport.width,
          y: Math.min(y1, y2) / viewport.height,
          w: Math.abs(x2 - x1) / viewport.width,
          h: Math.abs(y2 - y1) / viewport.height,
        };
        if (a.fieldType === "Tx") {
          out.push({ name: a.fieldName, kind: "text", ...box, value: String(a.fieldValue ?? ""), multiline: !!a.multiLine });
        } else if (a.fieldType === "Btn" && a.checkBox) {
          const on = a.fieldValue && a.fieldValue !== "Off" && a.fieldValue === (a.exportValue ?? a.fieldValue);
          out.push({ name: a.fieldName, kind: "checkbox", ...box, value: on ? "true" : "false" });
        } else if (a.fieldType === "Btn" && a.radioButton) {
          out.push({ name: a.fieldName, kind: "radio", ...box, value: String(a.fieldValue ?? ""), exportValue: String(a.buttonValue ?? "") });
        } else if (a.fieldType === "Ch") {
          const options = (a.options ?? []).map((o: { exportValue: string; displayValue: string }) => ({ value: String(o.exportValue), label: String(o.displayValue) }));
          const v = Array.isArray(a.fieldValue) ? a.fieldValue[0] : a.fieldValue;
          out.push({ name: a.fieldName, kind: "select", ...box, value: String(v ?? ""), options });
        }
      }
      page.cleanup();
      return out;
    },
    destroy() {
      void task.destroy();
    },
  };
}
