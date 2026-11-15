import { vi } from "vitest";

export const router = {
  push: vi.fn<(href: string) => void>(),
  replace: vi.fn<(href: string) => void>(),
  back: vi.fn<() => void>(),
  prefetch: vi.fn<(href: string) => void>(),
  refresh: vi.fn<() => void>(),
};

export const search = { current: new URLSearchParams() };

export function navigationMock() {
  return {
    useRouter: () => router,
    usePathname: () => "/",
    useSearchParams: () => search.current,
  };
}

export function resetNavigation(query = ""): void {
  Object.values(router).forEach((fn) => {
    fn.mockReset();
  });
  search.current = new URLSearchParams(query);
}
