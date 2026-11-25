import { sebookEnv } from "@/lib/env";
import { relayKey } from "./relayKey";

const MARKETPLACE = "/api/v1/marketplace";
const TIMEOUT_MS = 8000;

export type Fetched = { status: "ok"; json: unknown } | { status: "absent" } | { status: "unavailable" };

function requestHeaders(visitor: string | null): Record<string, string> {
  const accept = { Accept: "application/json" };
  const key = relayKey();
  if (key === null) return accept;
  return { ...accept, "X-Sebook-Relay-Key": key, ...(visitor === null ? {} : { "X-Sebook-Client-Ip": visitor }) };
}

export async function getPublic(path: string, params?: URLSearchParams, visitor: string | null = null): Promise<Fetched> {
  const base = sebookEnv().apiUrl;
  const url = new URL(`${MARKETPLACE}${path}`.replace(/^\//, ""), base.endsWith("/") ? base : `${base}/`);
  if (params) url.search = params.toString();
  const headers = requestHeaders(visitor);
  try {
    const response = await fetch(url, { headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (response.status === 404) return { status: "absent" };
    if (!response.ok) return { status: "unavailable" };
    return { status: "ok", json: (await response.json()) as unknown };
  } catch {
    return { status: "unavailable" };
  }
}
