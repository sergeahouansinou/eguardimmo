import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { FaqAccordion } from "./FaqAccordion";

const ENTRIES = [
  { question: "Première question ?", answer: "Première réponse." },
  { question: "Deuxième question ?", answer: "Deuxième réponse." },
];

describe("FaqAccordion", () => {
  it("n’a aucune violation d’accessibilité", async () => {
    const { container } = render(<FaqAccordion entries={ENTRIES} headingLevel={2} />);
    await expectNoA11yViolations(container);
  });

  it("ouvre la première question, lie bouton et région, et bascule au clavier", async () => {
    const user = userEvent.setup();
    render(<FaqAccordion entries={ENTRIES} headingLevel={3} />);
    const first = screen.getByRole("button", { name: "Première question ?" });
    const second = screen.getByRole("button", { name: "Deuxième question ?" });
    expect(first.getAttribute("aria-expanded")).toBe("true");
    expect(second.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("region", { name: "Première question ?" })).not.toBeNull();
    expect(screen.queryByRole("region", { name: "Deuxième question ?" })).toBeNull();

    await user.tab();
    expect(document.activeElement).toBe(first);
    await user.tab();
    expect(document.activeElement).toBe(second);
    await user.keyboard("{Enter}");
    expect(second.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("region", { name: "Deuxième question ?" })).not.toBeNull();
    await user.keyboard(" ");
    expect(second.getAttribute("aria-expanded")).toBe("false");
    expect(second.getAttribute("aria-controls")).not.toBeNull();
  });

  it("garde les réponses dans le document (indexables) même repliées", () => {
    render(<FaqAccordion entries={ENTRIES} headingLevel={3} />);
    expect(screen.getByText("Deuxième réponse.", { selector: "p" })).not.toBeNull();
  });

  it("utilise le niveau de titre demandé", () => {
    render(<FaqAccordion entries={ENTRIES} headingLevel={3} />);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(2);
  });
});
