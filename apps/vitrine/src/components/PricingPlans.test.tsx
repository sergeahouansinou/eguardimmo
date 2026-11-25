import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { parsePriceConfig, planViews } from "@/lib/pricing";
import { PricingPlans } from "./PricingPlans";

describe("PricingPlans", () => {
  it("sans configuration : « [À RENSEIGNER] » ×2, « Sur devis », aucun montant ni bascule de période", async () => {
    const plans = planViews(parsePriceConfig(undefined));
    const { container } = render(<PricingPlans plans={plans} showPeriods={false} />);
    expect(screen.getAllByText("[À RENSEIGNER]")).toHaveLength(2);
    expect(screen.getByText("Sur devis")).not.toBeNull();
    expect(container.textContent).not.toMatch(/€|\$|\d/);
    expect(screen.queryByRole("group", { name: "Période de facturation" })).toBeNull();
    expect(screen.getByRole("link", { name: "Nous contacter" }).getAttribute("href")).toBe("/contact");
    await expectNoA11yViolations(container);
  });

  it("avec des montants configurés : bascule mensuel/annuel, montant manquant remplacé par le champ à renseigner", async () => {
    const plans = planViews(parsePriceConfig('{"essentiel":{"monthly":"10 € HT","yearly":"100 € HT"},"agence":{"monthly":"20 € HT"}}'));
    const user = userEvent.setup();
    const { container } = render(<PricingPlans plans={plans} showPeriods />);
    const item = (index: number): HTMLElement => {
      const found = screen.getAllByRole("listitem")[index];
      if (!found) throw new Error(`Formule ${String(index)} absente.`);
      return found;
    };

    expect(within(item(0)).getByText("10 € HT")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Mensuel" }).getAttribute("aria-pressed")).toBe("true");

    await user.click(screen.getByRole("button", { name: "Annuel" }));
    expect(screen.getByRole("button", { name: "Annuel" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(item(0)).getByText("100 € HT")).not.toBeNull();
    expect(within(item(1)).getByText("[À RENSEIGNER]")).not.toBeNull();
    await expectNoA11yViolations(container);
  });
});
