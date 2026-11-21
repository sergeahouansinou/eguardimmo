import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bailleurHelpCenter, mandantHelpCenter } from "@/features/aide/helpContent";
import { MessagerieSpaceProvider } from "./SpaceProvider";
import { flowNavigation, renderFlow } from "./testing";

vi.mock("@/lib/env", () => ({
  dataSource: "api",
  apiEnv: () => ({ NEXT_PUBLIC_API_URL: "http://localhost:8000", NEXT_PUBLIC_DATA_SOURCE: "api" }),
}));
vi.mock("next/link", async () => ({ default: (await import("./testing")).FlowLink }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  flowNavigation.push = () => undefined;
});

describe.each([
  ["bailleur", "bailleur", "", bailleurHelpCenter, "Prêts et coût de revient"],
  ["proprietaire", "mandant", "/confie", mandantHelpCenter, "Comptes rendus et loyers"],
] as const)("centre d'aide en mode api, espace %s", (space, _label, prefix, help, category) => {
  it("affiche le contenu éditorial de l'espace, sans donnée de démonstration", async () => {
    renderFlow({
      prefix,
      start: `${prefix}/aide`,
      wrap: (children) => <MessagerieSpaceProvider space={space}>{children}</MessagerieSpaceProvider>,
    });

    expect((await screen.findAllByText(category)).length).toBeGreaterThan(0);
    expect(help.categories.some((item) => item.title === category)).toBe(true);
    expect(screen.queryByText(/Delmas|Chevalier|\+33/)).toBeNull();
  });
});
