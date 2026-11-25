import { cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, vi } from "vitest";

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  },
);

Element.prototype.hasPointerCapture = vi.fn(() => false);
Element.prototype.releasePointerCapture = vi.fn();
Element.prototype.scrollIntoView = vi.fn();

URL.createObjectURL = vi.fn(() => "blob:demo");
URL.revokeObjectURL = vi.fn();

afterEach(cleanup);

vi.mock("next/navigation", async () => {
  const { nav } = await import("./navigation");
  return {
    usePathname: () => nav.pathname,
    useSearchParams: () => new URLSearchParams(nav.search),
    useRouter: () => ({ push: nav.push, replace: nav.replace, back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
    unstable_rethrow: () => undefined,
    notFound: () => {
      throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
    },
  };
});

vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children?: ReactNode } & Record<string, unknown>) =>
      createElement("a", { href, ...props }, children),
  };
});

vi.mock("@/lib/navigate", () => ({ navigateTo: vi.fn() }));

vi.mock("next/headers", () => ({ headers: vi.fn(() => Promise.resolve(new Headers())) }));
