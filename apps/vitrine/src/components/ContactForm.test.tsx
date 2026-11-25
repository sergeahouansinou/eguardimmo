import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { sentBody } from "../../test/body";
import { ContactForm } from "./ContactForm";

function answer(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nom de l’organisation"), "Agence Rhône Immo");
  await user.type(screen.getByLabelText("E-mail professionnel"), "contact@agence-exemple.fr");
  await user.click(screen.getByRole("radio", { name: "Agence" }));
  await user.click(screen.getByRole("checkbox", { name: /J’accepte/ }));
}

describe("ContactForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("n’a aucune violation d’accessibilité", async () => {
    const { container } = render(<ContactForm contactEmail={undefined} />);
    await expectNoA11yViolations(container);
  });

  it("chemin nominal : envoie au serveur et n’affiche le succès que sur 202", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(answer(202, { code: "accepte", message: "Votre demande a été transmise." }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ContactForm contactEmail={undefined} />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Envoyer ma demande" }));

    expect(await screen.findByText("Demande transmise")).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/contact");
    expect(sentBody(init)).toEqual({
      organisation: "Agence Rhône Immo",
      email: "contact@agence-exemple.fr",
      profil: "agence",
      consentement: true,
    });
  });

  it("503 « envoi non configuré » : jamais de succès, message du serveur et adresse de repli", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(answer(503, { code: "envoi_non_configure", message: "Envoi non configuré : votre demande n’a pas été transmise." })));
    const user = userEvent.setup();
    render(<ContactForm contactEmail="contact@exemple.fr" />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Envoyer ma demande" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Envoi non configuré");
    expect(screen.queryByText("Demande transmise")).toBeNull();
    expect(screen.getByRole("link", { name: "contact@exemple.fr" }).getAttribute("href")).toBe("mailto:contact@exemple.fr");
    expect(screen.getByRole("button", { name: "Envoyer ma demande" }).hasAttribute("disabled")).toBe(false);
  });

  it("erreur réseau : message d’échec, jamais de succès", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("réseau")));
    const user = userEvent.setup();
    render(<ContactForm contactEmail={undefined} />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Envoyer ma demande" }));
    expect((await screen.findByRole("alert")).textContent).toContain("n’a pas été transmise");
    expect(screen.queryByText("Demande transmise")).toBeNull();
  });

  it("validation côté client : erreurs par champ, focus sur le premier invalide, aucun appel réseau", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ContactForm contactEmail={undefined} />);
    await user.click(screen.getByRole("button", { name: "Envoyer ma demande" }));

    expect(fetchMock).not.toHaveBeenCalled();
    const organisation = screen.getByLabelText("Nom de l’organisation");
    expect(organisation.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(organisation);
    expect(document.getElementById(organisation.getAttribute("aria-describedby") ?? "")?.textContent).toBe("Le nom de l’organisation est obligatoire.");
    expect(screen.getByLabelText("E-mail professionnel").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Choisissez votre profil.")).not.toBeNull();
    expect(screen.getByRole("checkbox", { name: /J’accepte/ }).getAttribute("aria-invalid")).toBe("true");
  });

  it("erreurs de validation renvoyées par le serveur : affichées sur les champs", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(answer(422, { code: "validation_echouee", message: "Certains champs sont invalides.", errors: { email: "Adresse refusée par le serveur." } })));
    const user = userEvent.setup();
    render(<ContactForm contactEmail={undefined} />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Envoyer ma demande" }));
    await waitFor(() => { expect(screen.getByText("Adresse refusée par le serveur.")).not.toBeNull(); });
    expect(screen.queryByText("Demande transmise")).toBeNull();
  });

  it("le leurre est caché aux technologies d’assistance et exclu de la tabulation", () => {
    const { container } = render(<ContactForm contactEmail={undefined} />);
    const trap = container.querySelector<HTMLInputElement>('input[name="siteWeb"]');
    expect(trap).not.toBeNull();
    expect(trap?.tabIndex).toBe(-1);
    expect(trap?.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
