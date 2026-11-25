import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MARKETPLACE, renderApp, stubApi } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { navigateTo } from "@/lib/navigate";
import { REF, problem } from "@/marketplace/responses.fixtures";
import ContactHostModal from "./ContactHostModal";

const VISIT = `${MARKETPLACE}/listings/${REF}/visit-requests`;

function open(onClose = vi.fn(), hostName: string | null = "Agence Rhône Immo") {
  const view = renderApp(<ContactHostModal reference={REF} hostName={hostName} onClose={onClose} />, { pathname: `/listings/${REF}` });
  return { ...view, onClose };
}

async function fill(user: ReturnType<typeof renderApp>["user"], slot: string, message = "") {
  if (slot) await user.type(screen.getByLabelText("Créneau souhaité"), slot);
  if (message) await user.type(screen.getByLabelText("Votre message (facultatif)"), message);
  await user.click(screen.getByRole("button", { name: "Envoyer la demande" }));
}

beforeEach(() => {
  vi.mocked(navigateTo).mockClear();
});

describe("Demander une visite", () => {
  it("envoie le créneau et le message puis confirme à l’hôte", async () => {
    const api = stubApi({ [`POST ${VISIT}`]: { status: 201, body: { data: { status: "new" } } } });
    const { user, container } = open();
    const dialog = screen.getByRole("dialog", { name: "Demander une visite" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText("Votre demande est transmise à Agence Rhône Immo.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Créneau souhaité"));
    await expectNoA11yViolations(container);

    await fill(user, "samedi 6 décembre, 10 h", "Nous sommes deux.");

    expect(await screen.findByText("Votre demande de visite a été transmise à Agence Rhône Immo.")).toBeTruthy();
    expect(api.last("POST", VISIT)?.json).toEqual({ requested_slot: "samedi 6 décembre, 10 h", message: "Nous sommes deux." });
    expect(vi.mocked(navigateTo)).not.toHaveBeenCalled();
  });

  it("le message est facultatif et un hôte inconnu reste désigné par « l’hôte »", async () => {
    const api = stubApi({ [`POST ${VISIT}`]: { status: 201, body: { data: {} } } });
    const { user } = open(vi.fn(), null);
    await fill(user, "dimanche matin");
    expect(await screen.findByText("Votre demande de visite a été transmise à l’hôte.")).toBeTruthy();
    expect(api.last("POST", VISIT)?.json).toEqual({ requested_slot: "dimanche matin", message: "" });
  });

  it("exige un créneau avant tout envoi", async () => {
    const api = stubApi();
    const { user } = open();
    await fill(user, "");
    expect(await screen.findByText("Indiquez un créneau souhaité.")).toBeTruthy();
    expect(screen.getByLabelText("Créneau souhaité").getAttribute("aria-invalid")).toBe("true");
    expect(api.count("POST", VISIT)).toBe(0);
  });

  it("session expirée (401) : redirige vers la connexion avec retour sur la fiche", async () => {
    stubApi({ [`POST ${VISIT}`]: { status: 401, body: problem(401, "unauthenticated", "Unauthenticated.") } });
    window.history.pushState({}, "", `/listings/${REF}`);
    const { user } = open();
    await fill(user, "lundi");
    await waitFor(() => {
      expect(vi.mocked(navigateTo)).toHaveBeenCalledTimes(1);
    });
    const target = new URL(String(vi.mocked(navigateTo).mock.calls[0]?.[0]));
    expect(target.origin + target.pathname).toBe("http://auth.test/connexion");
    expect(target.searchParams.get("return_to")).toContain(`/listings/${REF}`);
  });

  it("adresse e-mail non vérifiée (403) : propose le lien de vérification", async () => {
    stubApi({ [`POST ${VISIT}`]: { status: 403, body: problem(403, "email_unverified", "Email non vérifié.") } });
    const { user } = open();
    await fill(user, "lundi");
    const link = await screen.findByRole("link", { name: "Confirmer mon adresse e-mail" });
    expect(screen.getByRole("alert").textContent).toContain("Confirmez votre adresse e-mail pour continuer.");
    expect(new URL(link.getAttribute("href") ?? "").pathname).toBe("/verification-email");
    expect(screen.getByLabelText("Créneau souhaité")).toBeTruthy();
  });

  it("trop de demandes (429) : affiche l’erreur et garde la saisie", async () => {
    stubApi({ [`POST ${VISIT}`]: { status: 429, body: problem(429, "rate_limited", "Too many.") } });
    const { user } = open();
    await fill(user, "lundi", "Bonjour");
    expect((await screen.findByRole("alert")).textContent).toContain("Trop de demandes");
    expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Votre message (facultatif)" }).value).toBe("Bonjour");
  });

  it("se ferme avec Échap et avec le bouton Fermer, et rend le focus", async () => {
    stubApi();
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const { user, onClose, unmount } = open();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Fermer" }));
    expect(onClose).toHaveBeenCalledTimes(2);
    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("garde le focus dans la fenêtre avec Tab", async () => {
    stubApi();
    const { user } = open();
    const close = screen.getByRole("button", { name: "Fermer" });
    const send = screen.getByRole("button", { name: "Envoyer la demande" });
    send.focus();
    await user.tab();
    expect(document.activeElement).toBe(close);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(send);
  });
});
