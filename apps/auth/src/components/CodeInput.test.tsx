import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { CodeInput } from "./CodeInput";

function Harness() {
  const [value, setValue] = useState("");
  return (
    <>
      <CodeInput label="Code" value={value} onChange={setValue} />
      <output data-testid="valeur">{value}</output>
    </>
  );
}

describe("CodeInput", () => {
  it("expose six cases numériques nommées, sans violation", async () => {
    const { container } = render(<Harness />);
    expect(screen.getAllByRole("textbox")).toHaveLength(6);
    expect(screen.getByLabelText("Code, chiffre 3 sur 6").getAttribute("inputmode")).toBe("numeric");
    await expectNoA11yViolations(container);
  });

  it("avance de case en case et ignore les caractères non numériques", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Code, chiffre 1 sur 6"));
    await user.keyboard("4a8");
    expect(screen.getByTestId("valeur").textContent).toBe("48");
  });

  it("accepte un code collé en entier, limité à six chiffres", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Code, chiffre 1 sur 6"));
    await user.paste("48 13 05 99");
    expect(screen.getByTestId("valeur").textContent).toBe("481305");
  });

  it("revient en arrière avec Retour arrière", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Code, chiffre 1 sur 6"));
    await user.keyboard("481");
    await user.keyboard("{Backspace}{Backspace}");
    expect(screen.getByTestId("valeur").textContent).toBe("4");
  });
});
