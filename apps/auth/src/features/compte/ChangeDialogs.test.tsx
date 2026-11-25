import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@eguardimmo/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestEnvironment, renderWithAuth } from "../../../test/render";
import type { TestEnvironment } from "../../../test/render";
import { ChangePasswordDialog } from "./ChangeDialogs";
import { useNoticeStore } from "./noticeStore";

async function submit(environment: TestEnvironment, next: string) {
  const onOpenChange = vi.fn();
  renderWithAuth(<ChangePasswordDialog open onOpenChange={onOpenChange} />, environment);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/Mot de passe actuel \*/), "MotDePasse-2026");
  await user.type(screen.getByLabelText(/Nouveau mot de passe \*/), next);
  await user.type(screen.getByLabelText(/Confirmation \*/), next);
  await user.click(screen.getByRole("button", { name: "Enregistrer le mot de passe" }));
  return onOpenChange;
}

describe("ChangePasswordDialog", () => {
  beforeEach(() => {
    useNoticeStore.getState().dismiss();
  });

  it("accepte 6 caractères sans composition", async () => {
    const onOpenChange = await submit(createTestEnvironment("marc"), "azerty");
    await waitFor(() => { expect(onOpenChange).toHaveBeenCalledWith(false); });
  });

  it("refuse 5 caractères sans appeler le serveur", async () => {
    const environment = createTestEnvironment("marc");
    const changePassword = vi.fn(environment.source.changePassword);
    await submit({ ...environment, source: { ...environment.source, changePassword } }, "azert");
    expect(await screen.findByText("Le mot de passe doit contenir au moins 6 caractères.")).toBeTruthy();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("affiche sous le champ le refus du serveur", async () => {
    const environment = createTestEnvironment("marc");
    const refus = "Le champ mot de passe ne doit pas dépasser 255 caractères.";
    const changePassword = vi.fn(() => Promise.reject(new ApiError(422, "validation_failed", "Certains champs sont invalides.", { password: [refus] })));
    const onOpenChange = await submit({ ...environment, source: { ...environment.source, changePassword } }, "azerty");
    expect(await screen.findByText(refus)).toBeTruthy();
    expect(screen.queryByText(/Une erreur est survenue/)).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
