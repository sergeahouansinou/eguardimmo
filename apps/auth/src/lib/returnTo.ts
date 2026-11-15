import { type AppKind, appOfHost } from "./spaces";

const DEV_HOSTS = ["localhost:3010", "localhost:3020", "localhost:3030", "localhost:3040", "localhost:3050"];

function configuredHosts(): string[] {
  const raw = process.env.NEXT_PUBLIC_AUTH_RETURN_TO_ALLOWED_HOSTS;
  if (raw) {
    return raw
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean);
  }
  return process.env.NODE_ENV === "production" ? [] : DEV_HOSTS;
}

export const ALLOWED_RETURN_HOSTS: readonly string[] = configuredHosts();

export type ReturnTo =
  | { status: "absent" }
  | { status: "ok"; url: string; host: string; app: AppKind | null }
  | { status: "refused"; origin: string | null };

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".test");
}

function displayOrigin(url: URL): string {
  return `${url.protocol}//${url.host}`;
}

export function parseReturnTo(
  raw: string | null | undefined,
  allowedHosts: readonly string[] = ALLOWED_RETURN_HOSTS,
): ReturnTo {
  if (raw === null || raw === undefined || raw.trim() === "") return { status: "absent" };
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { status: "refused", origin: null };
  }
  const origin = url.protocol === "http:" || url.protocol === "https:" ? displayOrigin(url) : null;
  if (origin === null) return { status: "refused", origin: null };
  if (url.username !== "" || url.password !== "") return { status: "refused", origin };
  if (url.protocol === "http:" && !isLocalHost(url.hostname)) return { status: "refused", origin };
  if (!allowedHosts.includes(url.host.toLowerCase())) return { status: "refused", origin };
  return { status: "ok", url: url.href, host: url.host.toLowerCase(), app: appOfHost(url.host.toLowerCase()) };
}

export function isInternalPath(path: string | null | undefined): path is string {
  if (path === null || path === undefined) return false;
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return false;
  if (/[\u0000-\u001f\u007f]/.test(path)) return false;
  try {
    return new URL(path, "http://interne.invalid").host === "interne.invalid";
  } catch {
    return false;
  }
}

export function homeUrlOfApp(app: AppKind, allowedHosts: readonly string[] = ALLOWED_RETURN_HOSTS): string | null {
  const host = allowedHosts.find((candidate) => appOfHost(candidate) === app);
  if (host === undefined) return null;
  const hostname = host.split(":")[0] ?? host;
  return `${isLocalHost(hostname) ? "http" : "https"}://${host}/`;
}
