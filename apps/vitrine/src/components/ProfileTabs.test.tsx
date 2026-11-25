import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { ProfileTabs } from "./ProfileTabs";

describe("ProfileTabs", () => {
  it("n’a aucune violation d’accessibilité", async () => {
    const { container } = render(<ProfileTabs />);
    await expectNoA11yViolations(container);
  });

  it("un onglet par profil, agence sélectionné par défaut, tout le contenu reste dans le document", () => {
    const { container } = render(<ProfileTabs />);
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Agence", "Propriétaire", "Locataire"]);
    expect(screen.getByRole("tab", { name: "Agence" }).getAttribute("aria-selected")).toBe("true");
    expect(container.textContent).toContain("Pour les propriétaires");
    expect(container.textContent).toContain("Pour les locataires");
  });

  it("change de profil à la souris et aux flèches du clavier", async () => {
    const user = userEvent.setup();
    render(<ProfileTabs />);
    await user.click(screen.getByRole("tab", { name: "Locataire" }));
    expect(screen.getByRole("tab", { name: "Locataire" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel", { name: "Locataire" })).not.toBeNull();
    expect(screen.getByRole("link", { name: "En savoir plus sur l’espace locataire" }).getAttribute("href")).toBe("/locataires");

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Propriétaire" }).getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Propriétaire" }));
  });
});
