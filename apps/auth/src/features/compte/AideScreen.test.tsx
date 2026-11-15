import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirectTo } from "@/lib/navigation";
import { renderWithAuth } from "../../../test/render";
import { expectNoA11yViolations } from "../../../test/axe";
import { resetNavigation, setLocation } from "../../../test/navigation";
import { AideScreen, SUPPORT_EMAIL } from "./AideScreen";

describe("AideScreen", () => {
  beforeEach(() => {
    resetNavigation();
    vi.mocked(redirectTo).mockReset();
  });

  it("sans espace d’origine, affiche la FAQ du compte et le contact support", async () => {
    setLocation("/compte/aide");
    const { container } = renderWithAuth(<AideScreen />);
    expect(screen.getByRole("heading", { level: 1, name: "Aide" })).toBeTruthy();
    expect(screen.getByRole("link", { name: SUPPORT_EMAIL }).getAttribute("href")).toBe(`mailto:${SUPPORT_EMAIL}`);
    expect(SUPPORT_EMAIL).toBe("support@eguardimmo.example");
    await userEvent.click(screen.getByText("J’ai oublié mon mot de passe"));
    expect(screen.getByRole("link", { name: "Réinitialiser mon mot de passe" }).getAttribute("href")).toBe("/mot-de-passe-oublie");
    expect(redirectTo).not.toHaveBeenCalled();
    await expectNoA11yViolations(container);
  });

  it("avec un espace d’origine autorisé, ouvre l’aide de cet espace", async () => {
    setLocation("/compte/aide?return_to=" + encodeURIComponent("http://localhost:3030/loyers?tri=date"));
    const { container } = renderWithAuth(<AideScreen />);
    await waitFor(() => { expect(redirectTo).toHaveBeenCalledTimes(1); });
    expect(redirectTo).toHaveBeenCalledWith("http://localhost:3030/aide");
    expect(screen.getByRole("link", { name: /Ouvrir l’aide/ }).getAttribute("href")).toBe("http://localhost:3030/aide");
    await expectNoA11yViolations(container);
  });

  it("n’ouvre jamais une adresse hors liste blanche et retombe sur l’aide du compte", () => {
    setLocation("/compte/aide?return_to=" + encodeURIComponent("https://pirate.example/"));
    renderWithAuth(<AideScreen />);
    expect(redirectTo).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1, name: "Aide" })).toBeTruthy();
  });
});
