import { vi } from "vitest";

export const router = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
  forward: vi.fn(),
};

export const navigationState = {
  pathname: "/",
  search: "",
};

export function setLocation(path: string): void {
  const [pathname = "/", search = ""] = path.split("?");
  navigationState.pathname = pathname;
  navigationState.search = search;
}

export function resetNavigation(): void {
  for (const fn of Object.values(router)) fn.mockReset();
  setLocation("/");
}
