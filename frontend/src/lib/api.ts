// Client for the Spring Boot API. Upload with progress, then poll the job until it finishes.

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export type JobStatus = "QUEUED" | "PROCESSING" | "DONE" | "FAILED";

export interface JobView {
  id: string;
  tool: string;
  status: JobStatus;
  error?: string;
  result?: {
    filename: string;
    size: number;
    downloadUrl: string;
    stats: Record<string, number | string>;
  };
  createdAt: string;
  expiresAt: string;
}

export class ApiError extends Error {}

function problemMessage(text: string, status: number): string {
  try {
    const body = JSON.parse(text);
    if (body?.detail) return body.detail as string;
  } catch {
    /* not JSON */
  }
  if (status === 413) return "Your files are larger than the upload limit.";
  if (status >= 500) return "The server had a problem. Please try again in a moment.";
  return "Something went wrong. Please try again.";
}

/** Uploads files + options; resolves with the queued job. */
export function startJob(
  apiId: string,
  files: File[],
  options: Record<string, string>,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<JobView> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f, f.name));
    Object.entries(options).forEach(([k, v]) => form.append(k, v));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/api/v1/tools/${apiId}/jobs`);
    xhr.responseType = "text";
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status === 202) resolve(JSON.parse(xhr.responseText));
      else reject(new ApiError(problemMessage(xhr.responseText, xhr.status)));
    };
    xhr.onerror = () => reject(new ApiError("Couldn't reach the server. Check your connection and try again."));
    xhr.onabort = () => reject(new DOMException("Cancelled", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(form);
  });
}

export async function getJob(id: string): Promise<JobView> {
  const res = await fetch(`${BASE}/api/v1/jobs/${id}`, { cache: "no-store" });
  if (!res.ok) throw new ApiError(problemMessage(await res.text(), res.status));
  return res.json();
}

/** Polls until DONE or FAILED. */
export async function waitForJob(id: string, signal?: AbortSignal, onUpdate?: (job: JobView) => void): Promise<JobView> {
  let delay = 400;
  for (;;) {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const job = await getJob(id);
    onUpdate?.(job);
    if (job.status === "DONE" || job.status === "FAILED") return job;
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.4, 2000);
  }
}

export function downloadUrl(job: JobView): string {
  return `${BASE}${job.result?.downloadUrl ?? ""}`;
}

export async function deleteJob(id: string): Promise<void> {
  await fetch(`${BASE}/api/v1/jobs/${id}`, { method: "DELETE" });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
