import { vi } from "vitest";

export const nav = {
  pathname: "/",
  search: "",
  push: vi.fn<(href: string) => void>(),
  replace: vi.fn<(href: string) => void>(),
};

export function resetNavigation(pathname = "/", search = ""): void {
  nav.pathname = pathname;
  nav.search = search;
  nav.push.mockClear();
  nav.replace.mockClear();
}
