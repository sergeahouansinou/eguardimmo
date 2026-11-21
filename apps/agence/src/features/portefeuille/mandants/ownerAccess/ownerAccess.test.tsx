import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../../../test/axe";
import { resetNavigation } from "../../../../../test/navigation";
import { ID, orgPath, problem } from "../../api/testing";
import { pickOption } from "../../testing";
import { OwnerAccessSection } from "./OwnerAccessSection";
import { ACCESS_ID, INVITATION_ID, OWNER_ACCESS_PATH, PAIRING_CODE, PERSON_ID, issued, ownerState, renderOwnerAccess } from "./testing";

vi.mock("next/navigation", async () => (await import("../../../../../test/navigation")).navigationMock());
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const IDENTITY = "J’atteste avoir vérifié l’identité du mandant";
const POWERS = "J’atteste avoir vérifié les pouvoirs du représentant";

function section(kind: "particulier" | "societe" = "particulier", canWrite = true) {
  return <OwnerAccessSection partyId={ID.mandant} mandantName="Claire Vasseur" mandantKind={kind} canWrite={canWrite} />;
}

async function openInvite(view: ReturnType<typeof renderOwnerAccess>) {
  await view.user.click(await screen.findByRole("button", { name: "Inviter à l’espace propriétaire" }));
  return screen.findByRole("dialog");
}

beforeEach(() => {
  resetNavigation();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("accès propriétaire sur la fiche mandant", () => {
  it("liste les accès et les invitations avec adresses masquées, sans jamais afficher de code", async () => {
    const view = renderOwnerAccess(section());

    const list = await screen.findByRole("list", { name: "Accès propriétaire du mandant" });

    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByText("Titulaire · a***@exemple.fr")).toBeTruthy();
    expect(within(list).getByText(/Compte rattaché le 02\/11\/2026/)).toBeTruthy();
    expect(within(list).getByText(/Invitation en attente, valable jusqu’au 30\/11\/2026 · 3 essais restants/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\b\d{6}\b/);
    await expectNoA11yViolations(view.container);
  });

  it("affiche un état vide invitant à inviter le mandant", async () => {
    renderOwnerAccess(section(), { [`GET ${OWNER_ACCESS_PATH}`]: { body: ownerState({ accesses: [], invitations: [] }) } });

    expect(await screen.findByText(/Aucun compte n’est rattaché à ce mandant/)).toBeTruthy();
  });

  it("propose de réessayer quand le chargement échoue", async () => {
    let calls = 0;
    const view = renderOwnerAccess(section(), { [`GET ${OWNER_ACCESS_PATH}`]: () => (++calls <= 3 ? problem(500, "boom", "x") : { body: ownerState() }) });

    expect(await screen.findByText("L’accès propriétaire n’a pas pu être chargé")).toBeTruthy();
    await view.user.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(await screen.findByRole("list", { name: "Accès propriétaire du mandant" })).toBeTruthy();
  });

  it("ne propose ni invitation ni retrait sans droit d'écriture", async () => {
    renderOwnerAccess(section("particulier", false), {}, "accountant");

    await screen.findByRole("list", { name: "Accès propriétaire du mandant" });

    expect(screen.queryByRole("button", { name: "Inviter à l’espace propriétaire" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Retirer/ })).toBeNull();
  });
});

describe("invitation d'un propriétaire", () => {
  it("exige l'attestation d'identité avant tout appel", async () => {
    const view = renderOwnerAccess(section());
    const dialog = await openInvite(view);

    await view.user.click(within(dialog).getByRole("button", { name: "Envoyer l’invitation" }));

    expect(await within(dialog).findByText(/Attestez avoir vérifié l’identité du mandant/)).toBeTruthy();
    expect(view.callsTo("POST", OWNER_ACCESS_PATH)).toHaveLength(0);
    await expectNoA11yViolations(dialog);
  });

  it("invite un titulaire, affiche le code une seule fois et ne le conserve nulle part", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const view = renderOwnerAccess(section(), { [`POST ${OWNER_ACCESS_PATH}`]: { status: 201, body: issued() } });
    const dialog = await openInvite(view);

    expect(within(dialog).getByText(/Le mandant sera averti à son adresse principale/)).toBeTruthy();
    await view.user.click(within(dialog).getByRole("checkbox", { name: IDENTITY }));
    await view.user.click(within(dialog).getByRole("button", { name: "Envoyer l’invitation" }));

    expect(await screen.findByRole("heading", { name: "Code d’appariement" })).toBeTruthy();
    expect(view.callsTo("POST", OWNER_ACCESS_PATH)[0]?.body).toEqual({ role: "holder", identity_verified: true, powers_verified: false });
    expect(screen.getByRole("status", { name: "Code d’appariement" }).textContent).toBe(PAIRING_CODE);
    expect(screen.getByText(/autre canal que l’e-mail/)).toBeTruthy();
    expect(screen.getByText("Ce code ne s’affiche qu’une seule fois")).toBeTruthy();
    expect(screen.getByText(/5 essais/)).toBeTruthy();
    await expectNoA11yViolations(screen.getByRole("dialog"));

    await view.user.click(screen.getByRole("button", { name: "Copier le code" }));
    expect(await screen.findByRole("button", { name: "Code copié" })).toBeTruthy();
    expect(await navigator.clipboard.readText()).toBe(PAIRING_CODE);

    await view.user.click(screen.getByRole("button", { name: "J’ai transmis le code" }));

    await waitFor(() => { expect(screen.queryByRole("dialog")).toBeNull(); });
    expect(document.body.textContent).not.toContain(PAIRING_CODE);
    expect(JSON.stringify(view.client.getQueryCache().getAll().map((query) => query.state.data))).not.toContain(PAIRING_CODE);
    expect(view.client.getMutationCache().getAll()).toHaveLength(0);
    expect(JSON.stringify([window.localStorage, window.sessionStorage, ...Object.entries(window.localStorage)])).not.toContain(PAIRING_CODE);
    expect(log).not.toHaveBeenCalled();
  });

  it("actualise la liste après l'invitation", async () => {
    let invited = false;
    const view = renderOwnerAccess(section(), {
      [`GET ${OWNER_ACCESS_PATH}`]: () => ({ body: invited ? ownerState() : ownerState({ accesses: [], invitations: [] }) }),
      [`POST ${OWNER_ACCESS_PATH}`]: () => {
        invited = true;
        return { status: 201, body: issued() };
      },
    });
    await screen.findByText(/Aucun compte n’est rattaché/);
    const dialog = await openInvite(view);
    await view.user.click(within(dialog).getByRole("checkbox", { name: IDENTITY }));
    await view.user.click(within(dialog).getByRole("button", { name: "Envoyer l’invitation" }));
    await screen.findByRole("heading", { name: "Code d’appariement" });

    expect(await screen.findByRole("list", { name: "Accès propriétaire du mandant", hidden: true })).toBeTruthy();
  });

  it("invite le représentant d'une société avec attestation des pouvoirs, fiche et e-mail", async () => {
    const view = renderOwnerAccess(section("societe"), { [`POST ${OWNER_ACCESS_PATH}`]: { status: 201, body: issued("representative") } });
    const dialog = await openInvite(view);

    await view.user.click(within(dialog).getByRole("checkbox", { name: IDENTITY }));
    await view.user.click(within(dialog).getByRole("button", { name: "Envoyer l’invitation" }));
    expect(await within(dialog).findByText(/Attestez avoir vérifié les pouvoirs du représentant/)).toBeTruthy();
    expect(view.callsTo("POST", OWNER_ACCESS_PATH)).toHaveLength(0);

    await pickOption(view.user, /Fiche du représentant/, "Jules Vasseur");
    await view.user.type(within(dialog).getByRole("textbox", { name: /Adresse e-mail à inviter/ }), "jules@example.com");
    await view.user.click(within(dialog).getByRole("checkbox", { name: POWERS }));
    await view.user.click(within(dialog).getByRole("button", { name: "Envoyer l’invitation" }));

    await screen.findByRole("heading", { name: "Code d’appariement" });
    expect(view.callsTo("POST", OWNER_ACCESS_PATH)[0]?.body).toEqual({
      role: "representative",
      person_party_id: PERSON_ID,
      email: "jules@example.com",
      identity_verified: true,
      powers_verified: true,
    });
  });

  it("exige la fiche d'un co-indivisaire et ne propose pas le mandant lui-même", async () => {
    const view = renderOwnerAccess(section(), { [`POST ${OWNER_ACCESS_PATH}`]: { status: 201, body: issued("co_owner") } });
    const dialog = await openInvite(view);

    await pickOption(view.user, /Rôle du compte invité/, /Co-indivisaire/);
    await view.user.click(within(dialog).getByRole("checkbox", { name: IDENTITY }));
    await view.user.click(within(dialog).getByRole("button", { name: "Envoyer l’invitation" }));
    expect(await within(dialog).findByText("Choisissez la fiche du co-indivisaire à inviter.")).toBeTruthy();

    await view.user.click(await screen.findByRole("combobox", { name: /Fiche du co-indivisaire/ }));
    expect(screen.queryByRole("option", { name: "Claire Vasseur" })).toBeNull();
    expect(screen.queryByRole("option", { name: "SCI Horizon" })).toBeNull();
    await view.user.click(await screen.findByRole("option", { name: "Jules Vasseur" }));
    await view.user.click(within(dialog).getByRole("button", { name: "Envoyer l’invitation" }));

    await screen.findByRole("heading", { name: "Code d’appariement" });
    expect(view.callsTo("POST", OWNER_ACCESS_PATH)[0]?.body).toEqual({ role: "co_owner", person_party_id: PERSON_ID, identity_verified: true, powers_verified: false });
  });

  it("refuse une adresse e-mail mal formée", async () => {
    const view = renderOwnerAccess(section());
    const dialog = await openInvite(view);

    await view.user.type(within(dialog).getByRole("textbox", { name: /Adresse e-mail à inviter/ }), "pas-un-mail");
    await view.user.click(within(dialog).getByRole("checkbox", { name: IDENTITY }));
    await view.user.click(within(dialog).getByRole("button", { name: "Envoyer l’invitation" }));

    expect(await within(dialog).findByText(/Saisissez une adresse e-mail valide/)).toBeTruthy();
    expect(view.callsTo("POST", OWNER_ACCESS_PATH)).toHaveLength(0);
  });

  it.each([
    ["two_factor_required", 403, /Activez la double authentification/, true],
    ["reauthentication_required", 403, /Confirmez votre identité avec un code de double authentification/, true],
    ["owner_access_limit_reached", 409, /nombre maximal de comptes rattachés/, false],
    ["owner_access_already_linked", 409, /déjà rattaché/, false],
    ["owner_access_party_archived", 409, /archivé/, false],
    ["party_anonymized", 409, /anonymisé/, false],
    ["party_not_found", 404, /n’existe pas ou n’est plus accessible/, false],
    ["role_forbidden", 403, /Votre rôle ne permet pas/, false],
    ["invitation_daily_limit_reached", 429, /nombre maximal d’invitations par jour/, false],
    ["un_code_du_futur", 409, /Une erreur est survenue\. Réessayez dans un instant\./, false],
  ] as const)("affiche l'erreur %s sans fermer la fenêtre", async (code, status, text, securityLink) => {
    const view = renderOwnerAccess(section(), { [`POST ${OWNER_ACCESS_PATH}`]: problem(status, code, "détail serveur brut") });
    const dialog = await openInvite(view);
    await view.user.click(within(dialog).getByRole("checkbox", { name: IDENTITY }));
    await view.user.click(within(dialog).getByRole("button", { name: "Envoyer l’invitation" }));

    expect(await within(dialog).findByText(text)).toBeTruthy();
    expect(within(dialog).queryByText(/détail serveur brut/)).toBeNull();
    expect(screen.queryByRole("heading", { name: "Code d’appariement" })).toBeNull();
    const link = within(dialog).queryByRole("link", { name: "Ouvrir Connexion et sécurité" });
    expect(link === null).toBe(!securityLink);
    if (link) expect(link.getAttribute("href")).toBe("/compte/securite");
  });

  it.each([
    ["owner_access_email_forbidden", 422, /celle de l’invitant ou d’un membre de l’agence/],
    ["owner_access_email_required", 422, /la fiche n’a pas d’e-mail principal/],
  ] as const)("rattache l'erreur %s au champ e-mail", async (code, status, text) => {
    const view = renderOwnerAccess(section(), { [`POST ${OWNER_ACCESS_PATH}`]: problem(status, code, "x") });
    const dialog = await openInvite(view);
    await view.user.click(within(dialog).getByRole("checkbox", { name: IDENTITY }));
    await view.user.click(within(dialog).getByRole("button", { name: "Envoyer l’invitation" }));

    const message = await within(dialog).findByText(text);

    expect(within(dialog).getByRole("textbox", { name: /Adresse e-mail à inviter/ }).getAttribute("aria-invalid")).toBe("true");
    expect(message.id).not.toBe("");
  });

  it("n'expose pas le code quand le serveur répond 201 avec un code malformé", async () => {
    const view = renderOwnerAccess(section(), { [`POST ${OWNER_ACCESS_PATH}`]: { status: 201, body: { data: { ...issued().data, pairing_code: "12" } } } });
    const dialog = await openInvite(view);
    await view.user.click(within(dialog).getByRole("checkbox", { name: IDENTITY }));
    await view.user.click(within(dialog).getByRole("button", { name: "Envoyer l’invitation" }));

    expect(await within(dialog).findByText(/Le serveur a répondu de façon inattendue/)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Code d’appariement" })).toBeNull();
  });
});

describe("retrait d'un accès ou d'une invitation", () => {
  it("retire un accès après confirmation", async () => {
    const view = renderOwnerAccess(section(), { [`DELETE ${OWNER_ACCESS_PATH}/${ACCESS_ID}`]: { status: 204 } });

    await view.user.click(await screen.findByRole("button", { name: "Retirer l’accès de a***@exemple.fr" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/perdra immédiatement l’accès à l’espace propriétaire de Claire Vasseur/)).toBeTruthy();
    expect(view.callsTo("DELETE", `${OWNER_ACCESS_PATH}/${ACCESS_ID}`)).toHaveLength(0);
    await view.user.click(within(dialog).getByRole("button", { name: "Retirer" }));

    expect(await screen.findByText("Accès retiré")).toBeTruthy();
    expect(view.callsTo("DELETE", `${OWNER_ACCESS_PATH}/${ACCESS_ID}`)).toHaveLength(1);
  });

  it("retire une invitation en attente", async () => {
    const view = renderOwnerAccess(section(), { [`DELETE ${OWNER_ACCESS_PATH}/${INVITATION_ID}`]: { status: 204 } });

    await view.user.click(await screen.findByRole("button", { name: "Retirer l’invitation de j***@exemple.fr" }));
    await view.user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Retirer" }));

    expect(await screen.findByText("Invitation retirée")).toBeTruthy();
    expect(view.callsTo("DELETE", `${OWNER_ACCESS_PATH}/${INVITATION_ID}`)).toHaveLength(1);
  });

  it("n'appelle rien quand la confirmation est annulée", async () => {
    const view = renderOwnerAccess(section());

    await view.user.click(await screen.findByRole("button", { name: "Retirer l’accès de a***@exemple.fr" }));
    await view.user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Annuler" }));

    await waitFor(() => { expect(screen.queryByRole("dialog")).toBeNull(); });
    expect(view.calls.some((call) => call.method === "DELETE")).toBe(false);
  });

  it("explique qu'un accès déjà retiré n'existe plus", async () => {
    const view = renderOwnerAccess(section(), { [`DELETE ${OWNER_ACCESS_PATH}/${ACCESS_ID}`]: problem(404, "owner_access_not_found", "x") });

    await view.user.click(await screen.findByRole("button", { name: "Retirer l’accès de a***@exemple.fr" }));
    await view.user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Retirer" }));

    expect(await screen.findByText("Retrait impossible")).toBeTruthy();
    expect(screen.getByText(/n’existe plus\. La liste est mise à jour/)).toBeTruthy();
  });
});

describe("fiche mandant en mode api", () => {
  it("n'appelle jamais l'API d'accès propriétaire sans session d'organisation", async () => {
    const { MandantDetailPage } = await import("../MandantDetailPage");
    const { createApiPortefeuilleSource } = await import("../../api/apiPortefeuille");
    const { createApiMandatesSource } = await import("../../api/mandatesSource");
    const { ORG, mandantRow, mandateSummary, mockApi, page } = await import("../../api/testing");
    const { renderPortefeuille } = await import("../../testing");
    const api = mockApi({
      [`GET ${orgPath("/mandates")}`]: { body: page([mandateSummary()]) },
      [`GET ${orgPath("/mandates/mandants")}`]: { body: { data: [mandantRow()] } },
    });
    const source = createApiPortefeuilleSource({ mandates: createApiMandatesSource({ client: api.client, organizationId: ORG }), agencyName: "Agence Soleil", canWrite: true, now: () => new Date(2026, 10, 16) });

    renderPortefeuille(<MandantDetailPage id={ID.mandant} />, source);
    await screen.findByRole("heading", { level: 1, name: "Claire Vasseur" });

    expect(screen.queryByRole("region", { name: "Espace propriétaire" })).toBeNull();
    expect(api.calls.some((call) => call.path.includes("owner-access"))).toBe(false);
  });
});
