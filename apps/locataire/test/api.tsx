import { TooltipProvider } from "@eguardimmo/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { vi } from "vitest";
import { FlashRegion, useFlash } from "@/components/flash";
import { TenantGate } from "@/tenant/session";
import { TENANT_PROFILES, ME } from "@/tenant/responses.fixtures";
import { resetNavigation } from "./navigation";

export const API_URL = "http://api.test";
export const AUTH_URL = "http://auth.test";

export interface RecordedCall {
  method: string;
  path: string;
  query: Record<string, string>;
  fields: Record<string, string>;
  files: Record<string, string[]>;
  json: unknown;
  headers: Record<string, string>;
}

export interface Reply {
  status?: number;
  body?: unknown;
  pdf?: string;
  headers?: Record<string, string>;
}

type Handler = Reply | ((call: RecordedCall) => Reply);

export interface ApiStub {
  calls: RecordedCall[];
  on: (method: string, path: string, handler: Handler) => void;
  count: (method: string, path: string) => number;
}

export function stubApi(initial: Record<string, Handler> = {}): ApiStub {
  const handlers = new Map<string, Handler>();
  const calls: RecordedCall[] = [];
  const on = (method: string, path: string, handler: Handler) => {
    handlers.set(`${method} ${path}`, handler);
  };
  on("GET", "/api/v1/me/profiles", { body: TENANT_PROFILES });
  on("GET", "/api/v1/me", { body: ME });
  on("GET", "/sanctum/csrf-cookie", { status: 204 });
  for (const [key, handler] of Object.entries(initial)) {
    const [method = "GET", path = ""] = key.split(" ");
    on(method, path, handler);
  }
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      const method = init?.method ?? "GET";
      const body = init?.body;
      const fields: Record<string, string> = {};
      const files: Record<string, string[]> = {};
      if (body instanceof FormData) {
        for (const [key, value] of body.entries()) {
          if (typeof value === "string") fields[key] = value;
          else files[key] = [...(files[key] ?? []), value.name];
        }
      }
      const headers = Object.fromEntries(new Headers(init?.headers).entries());
      const json: unknown = typeof body === "string" ? JSON.parse(body) : null;
      const call: RecordedCall = { method, path: url.pathname, query: Object.fromEntries(url.searchParams), fields, files, json, headers };
      calls.push(call);
      const handler = handlers.get(`${method} ${url.pathname}`);
      if (handler === undefined) return Promise.reject(new Error(`Appel réseau inattendu : ${method} ${url.pathname}`));
      const reply = typeof handler === "function" ? handler(call) : handler;
      const status = reply.status ?? 200;
      if (reply.pdf !== undefined) {
        return Promise.resolve(new Response(reply.pdf, { status, headers: { "Content-Type": "application/pdf", ...reply.headers } }));
      }
      const payload = status === 204 ? null : JSON.stringify(reply.body ?? {});
      return Promise.resolve(new Response(payload, { status, headers: { "Content-Type": "application/json", ...reply.headers } }));
    }),
  );
  return { calls, on, count: (method, path) => calls.filter((call) => call.method === method && call.path === path).length };
}

export function newClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

export function renderApi(
  ui: ReactElement,
  { pathname = "/", search = "", client = newClient() }: { pathname?: string; search?: string; client?: QueryClient } = {},
) {
  resetNavigation(pathname, search);
  useFlash.setState({ flash: null });
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <TenantGate apiUrl={API_URL} authUrl={AUTH_URL}>
          <FlashRegion />
          {ui}
        </TenantGate>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { ...view, user, client };
}
