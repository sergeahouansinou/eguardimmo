import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../test/axe";
import { OrgApiError } from "@/features/org/errors";
import { renderOrg } from "@/features/org/testRender";
import { createDemoRgpd } from "./demo";
import { PrivacyRequestsPage } from "./PrivacyRequestsPage";
import { RgpdSourceProvider } from "./RgpdSourceProvider";
import type { RgpdSource } from "./source";
import { deadlineStatus } from "./deadline";

function withSource(source: RgpdSource = createDemoRgpd()) {
  return renderOrg(
    <RgpdSourceProvider source={source}>
      <PrivacyRequestsPage />
    </RgpdSourceProvider>,
  );
}

describe("échéances", () => {
  it("qualifie l’urgence selon les jours restants", () => {
    expect(deadlineStatus("2026-11-09T23:59:59+00:00", "2026-11-13")).toEqual({ tone: "danger", label: "En retard de 4 jours" });
    expect(deadlineStatus("2026-11-12T23:59:59+00:00", "2026-11-13")).toEqual({ tone: "danger", label: "En retard d’un jour" });
    expect(deadlineStatus("2026-11-13T23:59:59+00:00", "2026-11-13")).toEqual({ tone: "danger", label: "À traiter aujourd’hui" });
    expect(deadlineStatus("2026-11-14T23:59:59+00:00", "2026-11-13")).toEqual({ tone: "warning", label: "Échéance demain" });
    expect(deadlineStatus("2026-11-18T23:59:59+00:00", "2026-11-13")).toEqual({ tone: "warning", label: "Échéance dans 5 jours" });
    expect(deadlineStatus("2026-12-04T23:59:59+00:00", "2026-11-13")).toEqual({ tone: "neutral", label: "Échéance dans 21 jours" });
  });
});

describe("demandes RGPD", () => {
  it("liste les demandes à traiter avec leur urgence et charge la suite", async () => {
    const user = userEvent.setup();
    const { container } = withSource();
    const table = await screen.findByRole("table", { name: "Demandes RGPD transmises" });
    expect(within(table).getByText("Pauline Lefort")).toBeTruthy();
    expect(within(table).getByText("En retard de 4 jours")).toBeTruthy();
    expect(within(table).getByText("Échéance dans 5 jours")).toBeTruthy();
    expect(within(table).getByText("Effacement")).toBeTruthy();
    await expectNoA11yViolations(container);
    await user.click(screen.getByRole("radio", { name: "Toutes" }));
    await user.click(screen.getByRole("button", { name: "Afficher plus de demandes" }));
    await waitFor(() => {
      expect(within(screen.getByRole("table", { name: "Demandes RGPD transmises" })).getByText("Julie Marchand")).toBeTruthy();
    });
  });

  it("exige une confirmation explicite avant de marquer une demande comme traitée", async () => {
    const user = userEvent.setup();
    const source = createDemoRgpd();
    const markHandled = vi.spyOn(source, "markHandled");
    withSource(source);
    await user.click(await screen.findByRole("button", { name: /Marquer comme traitée, demande de Anaïs Roux/ }));
    const dialog = await screen.findByRole("dialog", { name: "Marquer cette demande comme traitée ?" });
    const confirm = within(dialog).getByRole("button", { name: "Marquer comme traitée" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    await user.click(within(dialog).getByRole("checkbox", { name: /avoir traité cette demande/ }));
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
    expect(markHandled).not.toHaveBeenCalled();
    await user.click(confirm);
    await waitFor(() => {
      expect(markHandled).toHaveBeenCalledWith("rgpd-2026-0004");
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(screen.getByText("Demande marquée comme traitée")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /demande de Anaïs Roux/ })).toBeNull();
    await user.click(screen.getByRole("radio", { name: "Traitées" }));
    expect(within(screen.getByRole("table", { name: "Demandes RGPD transmises" })).getByText("Anaïs Roux")).toBeTruthy();
  });

  it("avertit qu’un effacement suppose une suppression réelle dans les outils de l’agence", async () => {
    const user = userEvent.setup();
    withSource();
    await user.click(await screen.findByRole("button", { name: /demande de Pauline Lefort/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Suppression ou anonymisation")).toBeTruthy();
    expect(within(dialog).getByText(/La plateforme n’efface rien à votre place/)).toBeTruthy();
    expect(within(dialog).getByText(/ne peut plus être rouverte/)).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Annuler" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("affiche l’échec serveur dans la boîte de dialogue sans rien marquer", async () => {
    const user = userEvent.setup();
    const source = createDemoRgpd();
    source.markHandled = () => Promise.reject(new OrgApiError("unavailable", "Le service est momentanément indisponible. Rien n’a été enregistré : réessayez dans un instant."));
    withSource(source);
    await user.click(await screen.findByRole("button", { name: /demande de Anaïs Roux/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(within(dialog).getByRole("button", { name: "Marquer comme traitée" }));
    expect(await within(dialog).findByText(/Rien n’a été enregistré/)).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Annuler" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(screen.getByRole("button", { name: /demande de Anaïs Roux/ })).toBeTruthy();
  });

  it("annonce l’absence de demande, l’accès refusé et une panne non vérifiable", async () => {
    const empty: RgpdSource = { ...createDemoRgpd(), list: () => Promise.resolve({ items: [], nextCursor: null }) };
    const first = withSource(empty);
    expect(await screen.findByText("Aucune demande à traiter")).toBeTruthy();
    expect(screen.getByText("Aucune demande ne vous a été transmise.")).toBeTruthy();
    first.unmount();

    const forbidden: RgpdSource = { ...createDemoRgpd(), list: () => Promise.reject(new OrgApiError("forbidden", "Seuls le titulaire et les administrateurs de l’agence voient et traitent les demandes RGPD.", { status: 403 })) };
    const second = withSource(forbidden);
    expect(await screen.findByText("Accès refusé")).toBeTruthy();
    second.unmount();

    const down: RgpdSource = { ...createDemoRgpd(), list: () => Promise.reject(new OrgApiError("unavailable", "Le serveur est injoignable.")) };
    withSource(down);
    expect(await screen.findByText(/non vérifiable pour le moment/)).toBeTruthy();
    expect(screen.queryByText("Aucune demande à traiter")).toBeNull();
  });
});
