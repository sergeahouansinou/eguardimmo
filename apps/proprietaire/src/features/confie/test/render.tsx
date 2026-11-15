import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { createConfieSource } from "@/confie-config/demo";
import { ConfieSourceProvider } from "../data/source";
import { ToastProvider } from "../ui/Toast";

export function renderWithSpace(ui: ReactElement) {
  const source = createConfieSource();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <ConfieSourceProvider source={source}>
        <ToastProvider>{ui}</ToastProvider>
      </ConfieSourceProvider>
    </QueryClientProvider>,
  );
  return { ...view, source };
}
