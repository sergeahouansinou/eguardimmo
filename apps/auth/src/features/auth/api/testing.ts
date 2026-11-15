import { createApiClient } from "@eguardimmo/api";
import { vi } from "vitest";
import { createApiAuthSource } from "./index";

export const FIXED_NOW = new Date("2026-11-15T10:00:00.000Z");

export function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

export function problem(
  status: number,
  code: string,
  extras: { errors?: Record<string, string[]>; retryAfter?: number } = {},
): Response {
  const { errors, retryAfter } = extras;
  return json(
    status,
    {
      type: `https://api.test/problems/${code}`,
      title: "Problème",
      status,
      detail: "Détail du problème.",
      code,
      ...(errors ? { errors } : {}),
      ...(retryAfter === undefined ? {} : { retry_after: retryAfter }),
      request_id: "req-1",
    },
    { "Content-Type": "application/problem+json", ...(retryAfter === undefined ? {} : { "Retry-After": String(retryAfter) }) },
  );
}

export const validation = (errors: Record<string, string[]>) => problem(422, "validation_failed", { errors });
export const noContent = () => new Response(null, { status: 204 });
export const emptyJson = (status: number) => new Response('""', { status, headers: { "Content-Type": "application/json" } });

export function setup(responses: Response[], now: () => Date = () => FIXED_NOW) {
  const queue = [...responses];
  const fetchImpl = vi.fn<typeof fetch>(() => {
    const next = queue.shift();
    return next ? Promise.resolve(next) : Promise.reject(new TypeError("Aucune réponse prévue"));
  });
  const client = createApiClient({ baseUrl: "https://api.test", fetchImpl, readCookie: () => "xsrf" });
  const source = createApiAuthSource(client, { now });
  const call = (index: number) => {
    const [input, init = {}] = fetchImpl.mock.calls[index] ?? ["", {}];
    const url = new URL(typeof input === "string" ? input : "");
    const body = typeof init.body === "string" ? (JSON.parse(init.body) as unknown) : null;
    return { url, method: init.method ?? "GET", body };
  };
  return { source, fetchImpl, call };
}
