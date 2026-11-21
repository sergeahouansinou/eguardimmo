import { vi } from "vitest";

export interface CapturedDownloads {
  names: string[];
  blobs: Blob[];
}

export function captureDownloads(): CapturedDownloads {
  const captured: CapturedDownloads = { names: [], blobs: [] };
  URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
    if (blob instanceof Blob) captured.blobs.push(blob);
    return "blob:test";
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function click(this: HTMLAnchorElement) {
    captured.names.push(this.download);
  });
  return captured;
}
