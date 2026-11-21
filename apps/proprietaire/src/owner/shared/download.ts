import { ApiUnreachableError, toApiError } from "@eguardimmo/api";
import type { ApiClient } from "@eguardimmo/api";
import { UnexpectedResponseError } from "../errors";

export type FileFormat = "pdf" | "any";

const REFUSED_TYPES = ["application/json", "application/problem+json", "text/html"];

export async function fetchFile(client: ApiClient, path: string, format: FileFormat, fetchImpl: typeof fetch = (...args) => fetch(...args)): Promise<Blob> {
  let response: Response;
  try {
    response = await fetchImpl(client.url(path), {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: format === "pdf" ? "application/pdf" : "*/*", "X-Requested-With": "XMLHttpRequest" },
    });
  } catch {
    throw new ApiUnreachableError();
  }
  if (!response.ok) throw await toApiError(response);
  const type = (response.headers.get("Content-Type") ?? "").toLowerCase();
  if (format === "pdf" ? !type.startsWith("application/pdf") : REFUSED_TYPES.some((refused) => type.startsWith(refused))) throw new UnexpectedResponseError();
  return response.blob();
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const EXTENSIONS: Readonly<Record<string, string>> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

export function downloadName(title: string, mimeType: string | null = null): string {
  const base = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const name = base === "" ? "document" : base;
  const extension = mimeType === null ? undefined : EXTENSIONS[mimeType];
  return extension !== undefined && !/\.(pdf|jpe?g|png)$/i.test(name) ? `${name}.${extension}` : name;
}
