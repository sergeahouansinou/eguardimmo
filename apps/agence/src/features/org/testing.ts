import { ApiError } from "@eguardimmo/api";
import type { ApiClient, Body, Query } from "@eguardimmo/api";

export interface RecordedCall {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  query: Query | undefined;
  body: Body | undefined;
}

export type Handler = (call: RecordedCall) => unknown;

export function problem(status: number, code: string, detail: string, errors: Record<string, string[]> = {}): ApiError {
  return new ApiError(status, code, detail, errors);
}

export function fakeClient(handler: Handler): ApiClient & { calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const run = (method: RecordedCall["method"], path: string, query?: Query, body?: Body): Promise<unknown> => {
    const call: RecordedCall = { method, path, query, body };
    calls.push(call);
    try {
      const result = handler(call);
      return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error("Échec simulé."));
    }
  };
  return {
    baseUrl: "https://api.test",
    calls,
    get: (path, query) => run("GET", path, query),
    post: (path, body) => run("POST", path, undefined, body),
    patch: (path, body) => run("PATCH", path, undefined, body),
    put: (path, body) => run("PUT", path, undefined, body),
    delete: (path) => run("DELETE", path),
    url: (path) => `https://api.test${path}`,
  };
}

export const ORG_ID = "01934f6e-0000-7000-8000-00000000000b";
export const ORG_ROOT = `/api/v1/org/${ORG_ID}`;
