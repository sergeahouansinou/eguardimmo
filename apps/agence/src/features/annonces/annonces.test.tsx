import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../test/axe";
import { resetNavigation, router } from "../../../test/navigation";
import { OrgApiError } from "@/features/org/errors";
import { renderOrg } from "@/features/org/testRender";
import { AnnoncesPage } from "./AnnoncesPage";
import { AnnoncesSourceProvider } from "./AnnoncesSourceProvider";
import { createDemoAnnonces } from "./demo";
import { EditListingPage } from "./EditListingPage";
import { ListingDetailPage } from "./ListingDetailPage";
import { NewListingPage } from "./NewListingPage";
import type { ListingPayload } from "./schemas";
import type { AnnoncesSource } from "./source";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock());

function withSource(ui: React.ReactElement, source: AnnoncesSource = createDemoAnnonces()) {
  return renderOrg(<AnnoncesSourceProvider source={source}>{ui}</AnnoncesSourceProvider>);
}

const COMPLETE: ListingPayload = {
  category: "house",
  title: "Maison avec jardin à Bordeaux",
  description: null,
  neighbourhood: "Chartrons",
  priceMinor: 15000,
  currency: "EUR",
  depositMinor: null,
  capacity: 4,
  areaM2: 110,
  rooms: 5,
  amenities: [],
  minNights: 1,
  cancellationPolicy: "moderate",
};

async function cancel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Annuler" }));
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).toBeNull();
  });
}

beforeEach(() => {
  resetNavigation();
});

describe("liste des annonces", () => {
  it("liste, filtre par statut et charge la suite", async () => {
    const user = userEvent.setup();
    const { container } = withSource(<AnnoncesPage />);
    const table = await screen.findByRole("table", { name: "Annonces de l’agence" });
    expect(within(table).getByText("T3 familial avec balcon")).toBeTruthy();
    expect(within(table).getByText("980,00 € par mois")).toBeTruthy();
    expect(within(table).getByText("À renseigner")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Nouvelle annonce" }).getAttribute("href")).toBe("/annonces/nouvelle");
    await expectNoA11yViolations(container);
    await user.click(screen.getByRole("button", { name: "Afficher plus d’annonces" }));
    await waitFor(() => {
      expect(within(screen.getByRole("table", { name: "Annonces de l’agence" })).getByText("Studio rue Mazagran")).toBeTruthy();
    });
    await user.click(screen.getByRole("radio", { name: "Publiées" }));
    await waitFor(() => {
      expect(within(screen.getByRole("table", { name: "Annonces de l’agence" })).queryByText("Studio rue Mazagran")).toBeNull();
    });
    expect(within(screen.getByRole("table", { name: "Annonces de l’agence" })).getByText("Studio lumineux près du canal Saint-Martin")).toBeTruthy();
  });

  it("annonce l’absence d’annonce, l’accès refusé et une panne non vérifiable", async () => {
    const empty: AnnoncesSource = { ...createDemoAnnonces(), list: () => Promise.resolve({ items: [], nextCursor: null }) };
    const first = withSource(<AnnoncesPage />, empty);
    expect(await screen.findByText("Aucune annonce")).toBeTruthy();
    first.unmount();

    const forbidden: AnnoncesSource = { ...createDemoAnnonces(), list: () => Promise.reject(new OrgApiError("forbidden", "Seuls le titulaire, les administrateurs et les gestionnaires de l’agence gèrent les annonces.", { status: 403 })) };
    const second = withSource(<AnnoncesPage />, forbidden);
    expect(await screen.findByText("Accès refusé")).toBeTruthy();
    second.unmount();

    const down: AnnoncesSource = { ...createDemoAnnonces(), list: () => Promise.reject(new OrgApiError("unavailable", "Le serveur est injoignable.")) };
    withSource(<AnnoncesPage />, down);
    expect(await screen.findByText(/non vérifiable pour le moment/)).toBeTruthy();
    expect(screen.queryByText("Aucune annonce")).toBeNull();
  });
});

describe("création d’annonce", () => {
  it("crée un brouillon avec des montants en unités mineures puis ouvre sa fiche", async () => {
    const user = userEvent.setup();
    const source = createDemoAnnonces();
    const create = vi.spyOn(source, "create");
    withSource(<NewListingPage />, source);
    await user.click(await screen.findByRole("radio", { name: "Longue durée" }));
    await user.type(screen.getByRole("textbox", { name: "Titre" }), "T2 rénové");
    await user.type(screen.getByRole("textbox", { name: "Prix par mois" }), "720,50");
    await user.type(screen.getByRole("textbox", { name: "Capacité d’accueil" }), "3");
    await user.click(screen.getByRole("checkbox", { name: "Wi-Fi" }));
    await user.click(screen.getByRole("button", { name: "Créer le brouillon" }));
    await waitFor(() => {
      expect(create).toHaveBeenCalledTimes(1);
    });
    expect(create.mock.calls[0]?.[0]).toMatchObject({ kind: "long_term", title: "T2 rénové", priceMinor: 72050, capacity: 3, amenities: ["wifi"], currency: "EUR" });
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/annonces/ann-0006");
    });
  });

  it("refuse un formulaire invalide sans appeler le serveur", async () => {
    const user = userEvent.setup();
    const source = createDemoAnnonces();
    const create = vi.spyOn(source, "create");
    withSource(<NewListingPage />, source);
    await user.click(await screen.findByRole("button", { name: "Créer le brouillon" }));
    expect(await screen.findByText("Indiquez le titre de l’annonce.")).toBeTruthy();
    await user.type(screen.getByRole("textbox", { name: "Titre" }), "<b>Promo</b>");
    await user.type(screen.getByRole("textbox", { name: "Prix par nuit" }), "0");
    await user.click(screen.getByRole("button", { name: "Créer le brouillon" }));
    expect(await screen.findByText(/chevrons/)).toBeTruthy();
    expect(screen.getByText(/prix supérieur à zéro/)).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("affiche l’erreur du serveur dans le champ concerné", async () => {
    const user = userEvent.setup();
    const source = createDemoAnnonces();
    source.create = () => Promise.reject(new OrgApiError("invalid", "Titre invalide.", { status: 422, code: "validation_failed", fieldErrors: { title: ["Le titre contient un caractère interdit."] } }));
    withSource(<NewListingPage />, source);
    await user.type(await screen.findByRole("textbox", { name: "Titre" }), "Studio");
    await user.click(screen.getByRole("button", { name: "Créer le brouillon" }));
    expect(await screen.findByText("Le titre contient un caractère interdit.")).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("fiche d’annonce", () => {
  it("affiche une annonce publiée et l’archive après confirmation avec sa version", async () => {
    const user = userEvent.setup();
    const source = createDemoAnnonces();
    const archive = vi.spyOn(source, "archive");
    const { container } = withSource(<ListingDetailPage id="ann-0002" />, source);
    expect(await screen.findByRole("heading", { name: "Studio lumineux près du canal Saint-Martin" })).toBeTruthy();
    expect(screen.getByText("85,00 € par nuit")).toBeTruthy();
    expect(screen.getByText("Paris (75010)")).toBeTruthy();
    expect(screen.getByText("Wi-Fi, Cuisine équipée, Chauffage")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Publier" })).toBeNull();
    expect(screen.getByRole("link", { name: "Modifier" }).getAttribute("href")).toBe("/annonces/ann-0002/modifier");
    await expectNoA11yViolations(container);
    await user.click(screen.getByRole("button", { name: "Archiver" }));
    const dialog = await screen.findByRole("dialog", { name: "Archiver cette annonce ?" });
    expect(archive).not.toHaveBeenCalled();
    expect(within(dialog).getByText(/réservations déjà prises restent valables/)).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Archiver" }));
    await waitFor(() => {
      expect(archive).toHaveBeenCalledWith("ann-0002", 3);
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(await screen.findByText("Archivée")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Republier" })).toBeTruthy();
  });

  it("explique ce qui manque et bloque la publication d’un brouillon incomplet", async () => {
    withSource(<ListingDetailPage id="ann-0004" />);
    expect(await screen.findByText("Il manque la capacité d’accueil.")).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Publier" }).disabled).toBe(true);
  });

  it("publie un brouillon complet après confirmation", async () => {
    const user = userEvent.setup();
    const source = createDemoAnnonces();
    await source.update("ann-0004", 1, COMPLETE);
    const publish = vi.spyOn(source, "publish");
    withSource(<ListingDetailPage id="ann-0004" />, source);
    await user.click(await screen.findByRole("button", { name: "Publier" }));
    const dialog = await screen.findByRole("dialog", { name: "Publier cette annonce ?" });
    await user.click(within(dialog).getByRole("button", { name: "Publier" }));
    await waitFor(() => {
      expect(publish).toHaveBeenCalledWith("ann-0004", 2);
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(await screen.findByText("Publiée")).toBeTruthy();
  });

  it("recharge la fiche quand l’annonce a changé entre-temps", async () => {
    const user = userEvent.setup();
    const source = createDemoAnnonces();
    await source.update("ann-0004", 1, COMPLETE);
    source.publish = () => Promise.reject(new OrgApiError("stale", "L’annonce a été modifiée depuis sa lecture : rechargez-la avant de renvoyer vos changements.", { status: 409, code: "listing_stale_version" }));
    const get = vi.spyOn(source, "get");
    withSource(<ListingDetailPage id="ann-0004" />, source);
    await user.click(await screen.findByRole("button", { name: "Publier" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Publier" }));
    expect(await within(dialog).findByText(/vient d’être rechargée/)).toBeTruthy();
    await waitFor(() => {
      expect(get).toHaveBeenCalledTimes(2);
    });
    await cancel(user);
  });

  it("affiche les champs manquants renvoyés par le serveur", async () => {
    const user = userEvent.setup();
    const source = createDemoAnnonces();
    await source.update("ann-0004", 1, COMPLETE);
    source.publish = () => Promise.reject(new OrgApiError("invalid", "Annonce incomplète.", { status: 422, code: "listing_incomplete", extensions: { missing: ["city_id"] } }));
    withSource(<ListingDetailPage id="ann-0004" />, source);
    await user.click(await screen.findByRole("button", { name: "Publier" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Publier" }));
    expect(await within(dialog).findByText("Il manque la ville.")).toBeTruthy();
    await cancel(user);
  });

  it("distingue une annonce introuvable d’une panne", async () => {
    const missing: AnnoncesSource = { ...createDemoAnnonces(), get: () => Promise.reject(new OrgApiError("not_found", "Cette annonce n’existe pas ou n’appartient pas à votre organisation.", { status: 404 })) };
    const first = withSource(<ListingDetailPage id="inconnue" />, missing);
    expect(await screen.findByText("Annonce introuvable")).toBeTruthy();
    first.unmount();
    const down: AnnoncesSource = { ...createDemoAnnonces(), get: () => Promise.reject(new OrgApiError("unavailable", "Le serveur est injoignable.")) };
    withSource(<ListingDetailPage id="ann-0002" />, down);
    expect(await screen.findByText(/non vérifiable pour le moment/)).toBeTruthy();
    expect(screen.queryByText("Annonce introuvable")).toBeNull();
  });
});

describe("modification d’annonce", () => {
  it("envoie les changements avec la version lue, sans changer le type", async () => {
    const user = userEvent.setup();
    const source = createDemoAnnonces();
    const update = vi.spyOn(source, "update");
    withSource(<EditListingPage id="ann-0002" />, source);
    expect(await screen.findByText(/Courte durée/)).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "Longue durée" })).toBeNull();
    const title = screen.getByRole("textbox", { name: "Titre" });
    await user.clear(title);
    await user.type(title, "Studio rénové");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => {
      expect(update).toHaveBeenCalledTimes(1);
    });
    expect(update.mock.calls[0]?.[0]).toBe("ann-0002");
    expect(update.mock.calls[0]?.[1]).toBe(3);
    expect(update.mock.calls[0]?.[2]).toMatchObject({ title: "Studio rénové", priceMinor: 8500, capacity: 2 });
    expect(update.mock.calls[0]?.[2]).not.toHaveProperty("kind");
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/annonces/ann-0002");
    });
  });

  it("propose de recharger l’annonce après un conflit de version", async () => {
    const user = userEvent.setup();
    const source = createDemoAnnonces();
    source.update = () => Promise.reject(new OrgApiError("stale", "L’annonce a été modifiée depuis sa lecture : rechargez-la avant de renvoyer vos changements.", { status: 409, code: "listing_stale_version" }));
    const get = vi.spyOn(source, "get");
    withSource(<EditListingPage id="ann-0002" />, source);
    await user.click(await screen.findByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Annonce modifiée entre-temps")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Recharger l’annonce" }));
    await waitFor(() => {
      expect(get).toHaveBeenCalledTimes(2);
    });
    expect(router.push).not.toHaveBeenCalled();
  });

  it("ne propose aucune modification d’une annonce archivée", async () => {
    withSource(<EditListingPage id="ann-0001" />);
    expect(await screen.findByText("Annonce archivée")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enregistrer" })).toBeNull();
  });
});
