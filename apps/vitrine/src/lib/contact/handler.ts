import { clientKey, createRateLimiter } from "./rateLimit";
import type { RateLimiter } from "./rateLimit";
import { contactSchema, fieldErrors, MAX_BODY_BYTES } from "./schema";
import { resolveWebhook, sendToWebhook } from "./webhook";
import type { FetchLike, WebhookEnv } from "./webhook";

export interface ContactDeps {
  limiter: RateLimiter;
  webhook: WebhookEnv;
  siteOrigin: string;
  fetch: FetchLike;
  now: () => Date;
  log: (event: string) => void;
}

const NO_STORE = { "Cache-Control": "no-store" };

function reply(status: number, code: string, message: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}): Response {
  return Response.json({ code, message, ...extra }, { status, headers: { ...NO_STORE, ...headers } });
}

async function readLimited(request: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let received = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } catch {
    return "�";
  }
}

export async function handleContact(request: Request, deps: ContactDeps): Promise<Response> {
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== deps.siteOrigin) return reply(403, "origine_refusee", "Origine de la requête refusée.");

  const limit = deps.limiter.check(clientKey(request.headers), deps.now().getTime());
  if (!limit.allowed) {
    return reply(429, "trop_de_requetes", "Trop de demandes. Réessayez plus tard.", {}, { "Retry-After": String(limit.retryAfterSeconds) });
  }

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return reply(415, "type_non_pris_en_charge", "Le contenu doit être au format JSON.");
  }

  const body = await readLimited(request, MAX_BODY_BYTES);
  if (body === null) return reply(413, "requete_trop_volumineuse", "La demande est trop volumineuse.");

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return reply(400, "requete_invalide", "La demande est illisible.");
  }

  if (typeof json !== "object" || json === null || Array.isArray(json)) return reply(400, "requete_invalide", "La demande est illisible.");

  const parsed = contactSchema.safeParse(json);
  if (!parsed.success) {
    if (parsed.error.issues.some((issue) => issue.path[0] === "siteWeb" || issue.code === "unrecognized_keys")) {
      return reply(400, "requete_invalide", "La demande est invalide.");
    }
    return reply(422, "validation_echouee", "Certains champs sont invalides.", { errors: fieldErrors(parsed.error) });
  }

  const webhook = resolveWebhook(deps.webhook);
  if (webhook.status === "unconfigured") {
    deps.log("contact.envoi_non_configure");
    return reply(503, "envoi_non_configure", "Envoi non configuré : votre demande n’a pas été transmise.");
  }
  if (webhook.status === "invalid") {
    deps.log("contact.configuration_invalide");
    return reply(503, "configuration_invalide", "Envoi non configuré correctement : votre demande n’a pas été transmise.");
  }

  const sent = await sendToWebhook(webhook.url, parsed.data, deps.now(), deps.fetch);
  if (!sent) {
    deps.log("contact.envoi_echoue");
    return reply(502, "envoi_impossible", "L’envoi a échoué : votre demande n’a pas été transmise. Réessayez plus tard.");
  }
  deps.log("contact.envoye");
  return reply(202, "accepte", "Votre demande a été transmise.");
}

const limiter = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000, maxKeys: 10_000 });

export function runtimeDeps(siteOrigin: string): ContactDeps {
  return {
    limiter,
    webhook: { url: process.env.CONTACT_WEBHOOK_URL, allowedHosts: process.env.CONTACT_WEBHOOK_ALLOWED_HOSTS },
    siteOrigin,
    fetch: (input, init) => fetch(input, init),
    now: () => new Date(),
    log: (event) => {
      console.info(JSON.stringify({ event }));
    },
  };
}
