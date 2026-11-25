import type { ContactInput } from "./schema";

export type WebhookConfig =
  | { status: "unconfigured" }
  | { status: "invalid"; reason: string }
  | { status: "ready"; url: URL };

export interface WebhookEnv {
  url: string | undefined;
  allowedHosts: string | undefined;
}

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const INTERNAL_SUFFIXES = [".localhost", ".local", ".internal", ".test", ".invalid", ".lan", ".home.arpa"];

function isInternalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    !hostname.includes(".") ||
    hostname.endsWith(".") ||
    hostname.includes(":") ||
    hostname.startsWith("[") ||
    IPV4.test(hostname) ||
    INTERNAL_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  );
}

export function resolveWebhook({ url, allowedHosts }: WebhookEnv): WebhookConfig {
  const raw = url?.trim() ?? "";
  if (raw === "") return { status: "unconfigured" };

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { status: "invalid", reason: "adresse illisible" };
  }
  if (parsed.protocol !== "https:") return { status: "invalid", reason: "https obligatoire" };
  if (parsed.username !== "" || parsed.password !== "") return { status: "invalid", reason: "identifiants dans l’adresse refusés" };
  if (parsed.port !== "") return { status: "invalid", reason: "port explicite refusé" };

  const hostname = parsed.hostname.toLowerCase();
  if (isInternalHost(hostname)) return { status: "invalid", reason: "hôte interne ou adresse IP refusé" };

  const allowed = (allowedHosts ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host !== "");
  if (!allowed.includes(hostname)) return { status: "invalid", reason: "hôte absent de la liste blanche" };

  return { status: "ready", url: parsed };
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const SEND_TIMEOUT_MS = 5000;

export async function sendToWebhook(url: URL, input: ContactInput, receivedAt: Date, fetchImpl: FetchLike): Promise<boolean> {
  try {
    const response = await fetchImpl(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "vitrine",
        receivedAt: receivedAt.toISOString(),
        organisation: input.organisation,
        email: input.email,
        profil: input.profil,
        message: input.message ?? "",
      }),
      redirect: "error",
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}
