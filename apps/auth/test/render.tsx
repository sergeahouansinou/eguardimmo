import { TooltipProvider } from "@eguardimmo/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { createDemoAuthSource, memorySessionStore } from "../src/features/auth/demo";
import type { SessionStore } from "../src/features/auth/demo";
import { AuthSourceProvider } from "../src/features/auth/source";
import type { AuthSource } from "../src/features/auth/source";

export const FIXED_NOW = new Date("2026-11-14T10:00:00.000Z");

export interface TestEnvironment {
  source: AuthSource;
  store: SessionStore;
  advance: (seconds: number) => void;
}

export function createTestEnvironment(sessionAccountId: string | null = null): TestEnvironment {
  let current = FIXED_NOW.getTime();
  const store = memorySessionStore(sessionAccountId);
  const source = createDemoAuthSource({ now: () => new Date(current), sessionStore: store });
  return { source, store, advance: (seconds) => { current += seconds * 1000; } };
}

export function renderWithAuth(ui: ReactElement, environment: TestEnvironment = createTestEnvironment()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <AuthSourceProvider source={environment.source}>
        <TooltipProvider>{ui}</TooltipProvider>
      </AuthSourceProvider>
    </QueryClientProvider>,
  );
  return { ...view, environment };
}
