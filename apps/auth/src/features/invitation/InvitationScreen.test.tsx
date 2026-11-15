import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestEnvironment, renderWithAuth } from "../../../test/render";
import { expectNoA11yViolations } from "../../../test/axe";
import { resetNavigation, router, setLocation } from "../../../test/navigation";
import { InvitationScreen } from "./InvitationScreen";

describe("InvitationScreen", () => {
  beforeEach(() => {
    resetNavigation();
    setLocation("/invitation/locataire-koffi");
  });

  it("active l’espace avec une invitation valide", async () => {
    const environment = createTestEnvironment();
    const { container } = renderWithAuth(<InvitationScreen token="locataire-koffi" />, environment);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Mot de passe \*/), "Mot-De-Passe-2026");
    await expectNoA11yViolations(container);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Activer mon espace" }));
    await waitFor(() => { expect(router.push).toHaveBeenCalledWith("/connexion?activation=1"); });
    expect(await environment.source.getInvitation("locataire-koffi")).toEqual({ status: "invalid" });
  });

  it("refuse l’activation sans acceptation des conditions", async () => {
    renderWithAuth(<InvitationScreen token="locataire-koffi" />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Mot de passe \*/), "Mot-De-Passe-2026");
    await user.click(screen.getByRole("button", { name: "Activer mon espace" }));
    expect(await screen.findByText(/Acceptez les conditions/)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("affiche l’invitation expirée ou inconnue", async () => {
    const { container } = renderWithAuth(<InvitationScreen token="inconnue" />);
    expect(await screen.findByText("Invitation expirée ou déjà utilisée")).toBeTruthy();
    await expectNoA11yViolations(container);
  });
});
