import { useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { vi } from "vitest";

interface Location {
  pathname: string;
  search: string;
}

let location: Location = { pathname: "/confie", search: "" };
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setLocation(pathname: string, search = ""): void {
  location = { pathname, search };
  emit();
}

export function currentLocation(): Location {
  return location;
}

export const replace = vi.fn((href: string) => {
  const [pathname = "", search = ""] = href.split("?");
  location = { pathname, search };
  emit();
});
export const push = vi.fn();

export const navigationMock = {
  useRouter: () => ({ push, replace, back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => useSyncExternalStore(subscribe, () => location.pathname, () => location.pathname),
  useSearchParams: () => {
    const search = useSyncExternalStore(subscribe, () => location.search, () => location.search);
    return new URLSearchParams(search);
  },
  notFound: () => {
    throw new Error("notFound");
  },
};

export const linkMock = {
  default: ({ href, children, ...props }: { href: string; children?: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
};
