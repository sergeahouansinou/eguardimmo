import { z } from "zod";

export type DownloadOutcome =
  | { kind: "ok"; blob: Blob }
  | { kind: "not_found" }
  | { kind: "rate_limited"; retryAfterSeconds: number }
  | { kind: "unavailable" }
  | { kind: "unreachable" };

const DEFAULT_RETRY_SECONDS = 60;
const MAX_RETRY_SECONDS = 3600;

const problemSchema = z.object({ retry_after: z.number().optional() });

function clampSeconds(value: number): number {
  return Math.min(Math.max(Math.ceil(value), 1), MAX_RETRY_SECONDS);
}

async function retryAfterOf(response: Response): Promise<number> {
  const header = Number(response.headers.get("Retry-After"));
  if (Number.isFinite(header) && header > 0) return clampSeconds(header);
  try {
    const parsed = problemSchema.safeParse(await response.json());
    if (parsed.success && parsed.data.retry_after !== undefined && parsed.data.retry_after > 0) return clampSeconds(parsed.data.retry_after);
  } catch {
    return DEFAULT_RETRY_SECONDS;
  }
  return DEFAULT_RETRY_SECONDS;
}

export async function downloadTransmission(token: string, baseUrl: string, fetchImpl: typeof fetch = (...args) => fetch(...args)): Promise<DownloadOutcome> {
  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/api/v1/recovery/downloads/${encodeURIComponent(token)}`, {
      method: "GET",
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      headers: { Accept: "application/zip, application/problem+json" },
    });
  } catch {
    return { kind: "unreachable" };
  }
  if (response.status === 404) return { kind: "not_found" };
  if (response.status === 429) return { kind: "rate_limited", retryAfterSeconds: await retryAfterOf(response) };
  if (!response.ok) return { kind: "unavailable" };
  if (!(response.headers.get("Content-Type") ?? "").startsWith("application/zip")) return { kind: "unavailable" };
  try {
    return { kind: "ok", blob: await response.blob() };
  } catch {
    return { kind: "unreachable" };
  }
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
