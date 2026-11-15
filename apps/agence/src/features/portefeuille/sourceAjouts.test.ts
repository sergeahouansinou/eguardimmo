import { describe, expect, it } from "vitest";
import { formatRate } from "@/lib/money";
import { PortefeuilleError, createDemoSource, parsePortefeuille } from "./source";
import type { NewAvenant, NewBien, PortefeuilleSource } from "./source";

async function snapshot(source: PortefeuilleSource) {
  return parsePortefeuille(await source.load());
}

async function failure(promise: Promise<unknown>): Promise<PortefeuilleError> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof PortefeuilleError) return error;
    throw error;
  }
  throw new Error("Aucune erreur levée.");
}

const newBien: NewBien = {
  mandatId: "m-2025-0142",
  name: "Apt 8",
  kind: "T3",
  surfaceM2: 40,
  street: "40 rue de Brest",
  postalCode: "69002",
  city: "Lyon",
  floor: "",
  dpe: "",
  heating: "",
  syndic: "",
  propertyTax: "",
  targetRentMinor: 62_000,
  targetChargesMinor: 6_000,
};

const honoraires: NewAvenant = { mandatId: "m-2025-0142", kind: "honoraires", effectIso: "2026-11-13", feeBasisPoints: 650, note: "Accord du mandant" };

describe("création d'un bien", () => {
  it("rattache le lot au mandat et complète les champs vides", async () => {
    const source = createDemoSource();
    const bien = await source.createBien(newBien);
    expect(bien).toMatchObject({ id: "apt-8", mandatId: "m-2025-0142", floor: "Non renseigné", targetRentMinor: 62_000, targetChargesMinor: 6_000, pnoUntilIso: "2027-12-31" });
    const data = await snapshot(source);
    expect(data.biens).toHaveLength(15);
    expect(data.events.some((event) => event.kind === "bien" && event.subjectId === "apt-8")).toBe(true);
  });

  it("refuse un nom déjà pris", async () => {
    const error = await failure(createDemoSource().createBien({ ...newBien, name: "apt 12" }));
    expect(error.field).toBe("name");
  });

  it("refuse un mandat inconnu ou terminé", async () => {
    const source = createDemoSource();
    expect((await failure(source.createBien({ ...newBien, mandatId: "inconnu" }))).field).toBe("mandatId");
    expect((await failure(source.createBien({ ...newBien, mandatId: "m-2021-0044" }))).field).toBe("mandatId");
    expect((await snapshot(source)).biens).toHaveLength(14);
  });
});

describe("création d'un avenant", () => {
  it("applique les honoraires le jour même et alimente l'historique", async () => {
    const source = createDemoSource();
    const avenant = await source.createAvenant(honoraires);
    expect(avenant).toMatchObject({ number: "AV-2026-0001", applied: true, previous: formatRate(700), next: formatRate(650) });
    const data = await snapshot(source);
    expect(data.mandats.find((item) => item.id === "m-2025-0142")?.feeBasisPoints).toBe(650);
    expect(data.events.find((event) => event.id === "mandat-m-2025-0142-av-2026-0001")).toMatchObject({ title: "Avenant AV-2026-0001 appliqué", kind: "mandat" });
  });

  it("numérote les avenants à la suite", async () => {
    const source = createDemoSource();
    await source.createAvenant(honoraires);
    const second = await source.createAvenant({ ...honoraires, mandatId: "m-2024-0058", feeBasisPoints: 600 });
    expect(second.number).toBe("AV-2026-0002");
  });

  it("programme un avenant à effet futur sans toucher le mandat", async () => {
    const source = createDemoSource();
    const avenant = await source.createAvenant({ ...honoraires, effectIso: "2027-01-01" });
    expect(avenant.applied).toBe(false);
    expect((await snapshot(source)).mandats.find((item) => item.id === "m-2025-0142")?.feeBasisPoints).toBe(700);
  });

  it("prolonge un mandat à renouveler et le remet en cours", async () => {
    const source = createDemoSource();
    await source.createAvenant({ mandatId: "m-2023-0071", kind: "duree", effectIso: "2026-11-13", endIso: "2029-12-31", note: "" });
    expect((await snapshot(source)).mandats.find((item) => item.id === "m-2023-0071")).toMatchObject({ endIso: "2029-12-31", status: "actif" });
  });

  it("modifie le jour de reversement et le plafond de travaux", async () => {
    const source = createDemoSource();
    await source.createAvenant({ mandatId: "m-2025-0142", kind: "reversement", effectIso: "2026-11-13", payoutDay: 10, note: "" });
    await source.createAvenant({ mandatId: "m-2025-0142", kind: "travaux", effectIso: "2026-11-13", worksLimitMinor: 80_000, note: "" });
    expect((await snapshot(source)).mandats.find((item) => item.id === "m-2025-0142")).toMatchObject({ payoutDay: 10, worksLimitMinor: 80_000 });
  });

  it("refuse une date passée, une échéance antérieure et un mandat terminé", async () => {
    const source = createDemoSource();
    expect((await failure(source.createAvenant({ ...honoraires, effectIso: "2026-11-12" }))).field).toBe("effectIso");
    expect((await failure(source.createAvenant({ mandatId: "m-2025-0142", kind: "duree", effectIso: "2026-11-13", endIso: "2027-01-01", note: "" }))).field).toBe("endIso");
    expect((await failure(source.createAvenant({ ...honoraires, mandatId: "m-2021-0044" }))).field).toBe("mandatId");
    expect((await failure(source.createAvenant({ ...honoraires, mandatId: "inconnu" }))).field).toBe("mandatId");
    expect((await snapshot(source)).avenants).toHaveLength(0);
  });

  it("refuse un avenant sans valeur", async () => {
    const source = createDemoSource();
    expect((await failure(source.createAvenant({ mandatId: "m-2025-0142", kind: "honoraires", effectIso: "2026-11-13", note: "" }))).field).toBe("feePercent");
    expect((await failure(source.createAvenant({ mandatId: "m-2025-0142", kind: "reversement", effectIso: "2026-11-13", note: "" }))).field).toBe("payoutDay");
    expect((await failure(source.createAvenant({ mandatId: "m-2025-0142", kind: "travaux", effectIso: "2026-11-13", note: "" }))).field).toBe("worksLimit");
  });

  it("refuse un mandat dont la résiliation est programmée", async () => {
    const source = createDemoSource();
    await source.terminateMandat("m-2025-0142", { reason: "mandant", effectIso: "2027-03-31", noticeIso: "2026-11-13", note: "" });
    expect((await failure(source.createAvenant(honoraires))).field).toBe("mandatId");
  });
});

describe("invitations de locataires", () => {
  it("crée une invitation avec un lien de démonstration valable 14 jours", async () => {
    const source = createDemoSource();
    const invitation = await source.createInvitation({ email: "Louis.Petit@Example.com", bailId: "b-2026-004", message: "Bonjour, activez votre espace." });
    expect(invitation).toMatchObject({ id: "inv-0004", email: "louis.petit@example.com", name: "Louis Petit", status: "envoyee", sentIso: "2026-11-13", expiresIso: "2026-11-27" });
    expect(invitation.link.startsWith("https://locataire.eguardimmo.example/invitation/")).toBe(true);
    expect((await snapshot(source)).invitations).toHaveLength(4);
  });

  it("génère des liens distincts", async () => {
    const source = createDemoSource();
    const first = await source.createInvitation({ email: "a@example.com", bailId: "b-2026-004", message: "Bonjour, activez votre espace." });
    await source.cancelInvitation(first.id);
    const second = await source.createInvitation({ email: "a@example.com", bailId: "b-2026-004", message: "Bonjour, activez votre espace." });
    expect(second.link).not.toBe(first.link);
  });

  it("refuse un doublon en cours, un espace déjà actif et un bail inconnu ou terminé", async () => {
    const source = createDemoSource();
    expect((await failure(source.createInvitation({ email: "ines.laurent@example.com", bailId: "b-2026-016", message: "Bonjour, activez votre espace." }))).field).toBe("email");
    expect((await failure(source.createInvitation({ email: "thomas.girard@example.com", bailId: "b-2024-018", message: "Bonjour, activez votre espace." }))).field).toBe("bailId");
    expect((await failure(source.createInvitation({ email: "a@example.com", bailId: "inconnu", message: "Bonjour, activez votre espace." }))).field).toBe("bailId");
    expect((await failure(source.createInvitation({ email: "a@example.com", bailId: "b-2021-011", message: "Bonjour, activez votre espace." }))).field).toBe("bailId");
    expect((await snapshot(source)).invitations).toHaveLength(3);
  });

  it("renvoie une invitation expirée avec un nouveau délai", async () => {
    const source = createDemoSource();
    const renewed = await source.resendInvitation("inv-0002");
    expect(renewed).toMatchObject({ status: "envoyee", sentIso: "2026-11-13", expiresIso: "2026-11-27", reminders: 2 });
  });

  it("annule une invitation et refuse d'agir sur une invitation acceptée", async () => {
    const source = createDemoSource();
    expect((await source.cancelInvitation("inv-0001")).status).toBe("annulee");
    await failure(source.cancelInvitation("inv-0003"));
    await failure(source.resendInvitation("inv-0003"));
    await failure(source.cancelInvitation("inconnue"));
    await failure(source.resendInvitation("inconnue"));
  });
});

describe("avis d'échéance", () => {
  it("n'envoie que les avis manquants, sans doublon", async () => {
    const source = createDemoSource();
    const result = await source.sendAvis({ bailIds: ["b-2024-018", "b-2026-007", "b-2026-007"], month: "2026-12", resend: false });
    expect(result).toEqual({ sent: 1, skipped: 1 });
    expect((await snapshot(source)).avis.filter((item) => item.month === "2026-12")).toHaveLength(4);
  });

  it("renvoie un avis déjà envoyé et met à jour sa date", async () => {
    const source = createDemoSource();
    expect(await source.sendAvis({ bailIds: ["b-2024-018"], month: "2026-12", resend: true })).toEqual({ sent: 1, skipped: 0 });
    expect((await snapshot(source)).avis.find((item) => item.id === "b-2024-018@2026-12")?.sentIso).toBe("2026-11-13");
  });

  it("refuse un mois hors période, une sélection vide et un bail qui n'est pas en cours", async () => {
    const source = createDemoSource();
    expect((await failure(source.sendAvis({ bailIds: ["b-2024-018"], month: "2027-06", resend: false }))).field).toBe("month");
    expect((await failure(source.sendAvis({ bailIds: ["b-2024-018"], month: "2026-09", resend: false }))).field).toBe("month");
    expect((await failure(source.sendAvis({ bailIds: ["b-2024-018"], month: "decembre", resend: false }))).field).toBe("month");
    expect((await failure(source.sendAvis({ bailIds: [], month: "2026-12", resend: false }))).field).toBe("bailIds");
    expect((await failure(source.sendAvis({ bailIds: ["b-2026-022"], month: "2026-12", resend: false }))).field).toBe("bailIds");
    expect((await failure(source.sendAvis({ bailIds: ["b-2021-011"], month: "2026-12", resend: false }))).field).toBe("bailIds");
    expect((await snapshot(source)).avis).toHaveLength(17);
  });
});
