// Passes a result file to the next tool ("Continue with Compress PDF") without re-uploading
// from the user's device. Lives in memory and survives client-side navigation only.

let pending: File | null = null;

export function setHandoff(file: File) {
  pending = file;
}

export function peekHandoff(): File | null {
  return pending;
}

export function clearHandoff() {
  pending = null;
}
