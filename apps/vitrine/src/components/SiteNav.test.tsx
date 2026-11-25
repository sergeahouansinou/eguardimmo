import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { SiteNav } from "./SiteNav";

const ITEMS = [
  { href: "/agences", label: "Agences" },
  { href: "/", label: "Accueil" },
  { href: "https://sebook.exemple.fr", label: "SeBook", external: true },
];

describe("SiteNav", () => {
  it("n’a aucune violation d’accessibilité", async () => {
    const { container } = render(<SiteNav items={ITEMS} loginHref="https://auth.exemple.fr" />);
    await expectNoA11yViolations(container);
  });

  it("expose la navigation, la page courante et les liens externes tels que fournis", () => {
    render(<SiteNav items={ITEMS} loginHref="https://auth.exemple.fr" />);
    expect(screen.getByRole("navigation", { name: "Navigation principale" })).not.toBeNull();
    expect(screen.getByRole("link", { name: "Accueil" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Agences" }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("link", { name: "SeBook" }).getAttribute("href")).toBe("https://sebook.exemple.fr");
    expect(screen.getByRole("link", { name: "Se connecter" }).getAttribute("href")).toBe("https://auth.exemple.fr");
    expect(screen.getByRole("link", { name: "Demander une démonstration" }).getAttribute("href")).toBe("/contact");
  });

  it("le bouton de menu pilote aria-expanded et Échap le referme en rendant le focus", async () => {
    const user = userEvent.setup();
    render(<SiteNav items={ITEMS} loginHref="https://auth.exemple.fr" />);
    const toggle = screen.getByRole("button", { name: "Menu" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe("menu-principal");
    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    await user.keyboard("{Escape}");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle);
  });
});
