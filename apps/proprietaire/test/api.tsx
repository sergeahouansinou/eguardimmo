import { TooltipProvider } from "@eguardimmo/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { vi } from "vitest";
import { OwnerSelectionProvider } from "@/owner/selection";
import { OwnerGate } from "@/owner/session";
import { AGENCIES_RESPONSE } from "@/owner/responses.fixtures";

export const API_URL = "http://api.test";
export const AUTH_URL = "http://auth.test";

export interface RecordedCall {
  method: string;
  path: string;
  init: RequestInit | undefined;
  query: Record<string, string>;
  json: unknown;
}

export interface Reply {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  file?: { type: string; content: string };
}

type Handler = Reply | ((call: RecordedCall) => Reply);

export interface ApiStub {
  calls: RecordedCall[];
  fetchMock: ReturnType<typeof vi.fn>;
  on: (method: string, path: string, handler: Handler) => void;
  count: (method: string, path: string) => number;
}

export function stubApi(initial: Record<string, Handler> = {}): ApiStub {
  const handlers = new Map<string, Handler>();
  const calls: RecordedCall[] = [];
  const on = (method: string, path: string, handler: Handler) => {
    handlers.set(`${method} ${path}`, handler);
  };
  on("GET", "/api/v1/owner/agencies", { body: AGENCIES_RESPONSE });
  on("GET", "/sanctum/csrf-cookie", { status: 204 });
  for (const [key, handler] of Object.entries(initial)) {
    const [method = "GET", path = ""] = key.split(" ");
    on(method, path, handler);
  }
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = init?.method ?? "GET";
    const body = init?.body;
    const json: unknown = typeof body === "string" ? JSON.parse(body) : null;
    const call: RecordedCall = { method, path: url.pathname, init, query: Object.fromEntries(url.searchParams), json };
    calls.push(call);
    const handler = handlers.get(`${method} ${url.pathname}`);
    if (handler === undefined) return Promise.reject(new Error(`Appel réseau inattendu : ${method} ${url.pathname}`));
    const reply = typeof handler === "function" ? handler(call) : handler;
    const status = reply.status ?? 200;
    if (reply.file !== undefined) return Promise.resolve(new Response(reply.file.content, { status, headers: { "Content-Type": reply.file.type, ...reply.headers } }));
    const payload = status === 204 ? null : JSON.stringify(reply.body ?? {});
    return Promise.resolve(new Response(payload, { status, headers: { "Content-Type": "application/json", ...reply.headers } }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock, on, count: (method, path) => calls.filter((call) => call.method === method && call.path === path).length };
}

export function newClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

export function renderApi(ui: ReactElement, { client = newClient() }: { client?: QueryClient } = {}) {
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <OwnerGate apiUrl={API_URL} authUrl={AUTH_URL}>
          <OwnerSelectionProvider>{ui}</OwnerSelectionProvider>
        </OwnerGate>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { ...view, user, client };
}
