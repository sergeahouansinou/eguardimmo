import { sebookEnv } from "@/lib/env";

const MARKETPLACE = "/api/v1/marketplace";
const TIMEOUT_MS = 8000;

export type Fetched = { status: "ok"; json: unknown } | { status: "absent" } | { status: "unavailable" };

export async function getPublic(path: string, params?: URLSearchParams): Promise<Fetched> {
  const base = sebookEnv().apiUrl;
  const url = new URL(`${MARKETPLACE}${path}`.replace(/^\//, ""), base.endsWith("/") ? base : `${base}/`);
  if (params) url.search = params.toString();
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (response.status === 404) return { status: "absent" };
    if (!response.ok) return { status: "unavailable" };
    return { status: "ok", json: (await response.json()) as unknown };
  } catch {
    return { status: "unavailable" };
  }
}
