import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { INFO_PATHS } from "@/lib/seo";
import { renderApp, stubApi } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import Footer from "./Footer";

const ALLOWED = new Set(["/destinations", "/favorites", ...INFO_PATHS]);

describe("Footer", () => {
  it("n’expose que des liens vers des pages existantes", async () => {
    stubApi();
    const { container } = renderApp(<Footer />);
    const hrefs = [...container.querySelectorAll("a")].map((link) => link.getAttribute("href") ?? "");
    expect(hrefs.length).toBeGreaterThan(10);
    for (const href of hrefs) expect(ALLOWED.has(new URL(href, "http://x").pathname), href).toBe(true);
    await expectNoA11yViolations(container);
  });

  it("ne reprend ni destinations figées ni pages non portées", () => {
    stubApi();
    const { container } = renderApp(<Footer />);
    for (const gone of ["/devenir-hote", "/a-propos", "/parrainage", "/gestion-immobiliere", "/immobilier/"]) {
      expect(container.querySelector(`a[href^="${gone}"]`), gone).toBeNull();
    }
    expect(container.textContent).not.toMatch(/eGuardImmo|Inc\./);
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("explore les séjours et la longue durée via la recherche", () => {
    stubApi();
    renderApp(<Footer />);
    const nav = screen.getByRole("navigation", { name: "Explorer" });
    expect(within(nav).getByRole("link", { name: "Séjours" }).getAttribute("href")).toBe("/destinations");
    expect(within(nav).getByRole("link", { name: "Longue durée" }).getAttribute("href")).toBe("/destinations?portee=longue-duree");
    expect(within(nav).getByRole("link", { name: "Mes favoris" }).getAttribute("href")).toBe("/favorites");
  });

  it("bascule la langue FR/EN et mémorise le choix", async () => {
    stubApi();
    const { user } = renderApp(<Footer />);
    const group = screen.getByRole("group", { name: "Langue" });
    const french = within(group).getByRole("button", { name: "Français" });
    const english = within(group).getByRole("button", { name: "English (US)" });
    expect(french.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("link", { name: "Centre d’aide" })).toBeTruthy();

    await user.click(english);
    expect(english.getAttribute("aria-pressed")).toBe("true");
    expect(french.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("link", { name: "Help Centre" })).toBeTruthy();
    expect(window.localStorage.getItem("eg_lang")).toBe("en");

    await user.click(french);
    expect(screen.getByRole("link", { name: "Centre d’aide" })).toBeTruthy();
  });
});
