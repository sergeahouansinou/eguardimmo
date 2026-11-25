import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { vi } from "vitest";
import { ToastProvider } from "@/components/roost/Toast";
import { SessionProvider } from "@/features/session/SessionProvider";
import { I18nProvider } from "@/lib/i18n/context";
import { ME } from "@/marketplace/responses.fixtures";
import { resetNavigation } from "./navigation";

export const API_URL = "http://api.test";
export const AUTH_URL = "http://auth.test";
export const MARKETPLACE = "/api/v1/marketplace";

export interface RecordedCall {
  method: string;
  path: string;
  query: URLSearchParams;
  json: unknown;
  headers: Record<string, string>;
}

export interface Reply {
  status?: number;
  body?: unknown;
}

type Handler = Reply | ((call: RecordedCall) => Reply);

export interface ApiStub {
  calls: RecordedCall[];
  on: (method: string, path: string, handler: Handler) => void;
  count: (method: string, path: string) => number;
  last: (method: string, path: string) => RecordedCall | undefined;
}

export function stubApi(initial: Record<string, Handler> = {}): ApiStub {
  const handlers = new Map<string, Handler>();
  const calls: RecordedCall[] = [];
  const on = (method: string, path: string, handler: Handler) => {
    handlers.set(`${method} ${path}`, handler);
  };
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
      const json: unknown = typeof body === "string" ? JSON.parse(body) : null;
      const headers = Object.fromEntries(new Headers(init?.headers).entries());
      const call: RecordedCall = { method, path: url.pathname, query: url.searchParams, json, headers };
      calls.push(call);
      const handler = handlers.get(`${method} ${url.pathname}`);
      if (handler === undefined) return Promise.reject(new Error(`Appel réseau inattendu : ${method} ${url.pathname}`));
      const reply = typeof handler === "function" ? handler(call) : handler;
      const status = reply.status ?? 200;
      const payload = status === 204 ? null : JSON.stringify(reply.body ?? {});
      return Promise.resolve(new Response(payload, { status, headers: { "Content-Type": status >= 400 ? "application/problem+json" : "application/json" } }));
    }),
  );
  return {
    calls,
    on,
    count: (method, path) => calls.filter((call) => call.method === method && call.path === path).length,
    last: (method, path) => calls.filter((call) => call.method === method && call.path === path).at(-1),
  };
}

export function newClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

export function renderApp(ui: ReactElement, { pathname = "/", search = "", client = newClient() }: { pathname?: string; search?: string; client?: QueryClient } = {}) {
  resetNavigation(pathname, search);
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={client}>
      <SessionProvider apiUrl={API_URL} authUrl={AUTH_URL}>
        <I18nProvider>
          <ToastProvider>{ui}</ToastProvider>
        </I18nProvider>
      </SessionProvider>
    </QueryClientProvider>,
  );
  return { ...view, user, client };
}
