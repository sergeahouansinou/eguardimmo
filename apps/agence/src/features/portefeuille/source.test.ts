import { describe, expect, it } from "vitest";
import { parsePortefeuille, PortefeuilleError, createDemoSource } from "./source";
import type { NewBail, NewMandant, NewMandat } from "./source";

async function snapshot(source: ReturnType<typeof createDemoSource>) {
  return parsePortefeuille(await source.load());
}

const newMandant: NewMandant = {
  name: "Claire Vasseur",
  legal: "Particulier",
  type: "particulier",
  email: "claire.vasseur@example.com",
  phoneMasked: "+33 6 •• •• 56 78",
  address: "3 rue de Brest, Lyon",
  ibanLast4: "0189",
  ownerSpaceActive: false,
  reportsByEmail: true,
};

const lot8 = { name: "Apt 8", kind: "T3", surfaceM2: 40, street: "40 rue de Brest", postalCode: "69002", city: "Lyon" };

const newMandat: NewMandat = {
  mandantId: "marc-chevalier",
  lots: [lot8],
  feeBasisPoints: 700,
  payoutDay: 5,
  worksLimitMinor: 50_000,
  renewal: "aucune",
  startIso: "2026-12-01",
  endIso: "2029-11-30",
  signed: true,
};

const newBail: NewBail = {
  bienId: "apt-8",
  locataireId: "chloe-martin",
  startIso: "2026-12-01",
  endIso: "2029-11-30",
  furnished: false,
  rentMinor: 62_000,
  chargesMinor: 6_000,
  depositMinor: 62_000,
  dueDay: 5,
  paymentMode: "virement",
  draft: false,
};

describe("source de démonstration", () => {
  it("isole chaque instance", async () => {
    const first = createDemoSource();
    const second = createDemoSource();
    await first.createMandant(newMandant);
    expect((await snapshot(first)).mandants).toHaveLength(7);
    expect((await snapshot(second)).mandants).toHaveLength(6);
  });

  it("ne partage pas l'état interne avec l'appelant", async () => {
    const source = createDemoSource();
    const loaded = await snapshot(source);
    loaded.mandants.length = 0;
    expect((await snapshot(source)).mandants).toHaveLength(6);
  });

  describe("mandants", () => {
    it("crée un mandant visible au rechargement, avec un identifiant unique", async () => {
      const source = createDemoSource();
      const first = await source.createMandant(newMandant);
      const second = await source.createMandant(newMandant);
      expect(first.id).toBe("claire-vasseur");
      expect(second.id).toBe("claire-vasseur-2");
      expect((await snapshot(source)).mandants.map((mandant) => mandant.id)).toContain("claire-vasseur");
    });
  });

  describe("mandats", () => {
    it("crée un mandat actif et ses lots", async () => {
      const source = createDemoSource();
      const mandat = await source.createMandat(newMandat);
      const data = await snapshot(source);
      expect(mandat.status).toBe("actif");
      expect(mandat.number).toMatch(/^M-2026-\d{4}$/);
      expect(data.biens.find((bien) => bien.id === "apt-8")?.mandatId).toBe(mandat.id);
    });

    it("crée un brouillon quand le mandat n'est pas signé", async () => {
      const mandat = await createDemoSource().createMandat({ ...newMandat, signed: false });
      expect(mandat.status).toBe("brouillon");
    });

    it("numérote en séquence continue", async () => {
      const source = createDemoSource();
      const first = await source.createMandat(newMandat);
      const second = await source.createMandat({ ...newMandat, lots: [{ ...lot8, name: "Apt 9 bis" }] });
      expect(Number(second.number.slice(-4))).toBe(Number(first.number.slice(-4)) + 1);
    });

    it("refuse un mandant inconnu et un lot déjà existant", async () => {
      const source = createDemoSource();
      await expect(source.createMandat({ ...newMandat, mandantId: "inconnu" })).rejects.toMatchObject({ field: "mandantId" });
      await expect(source.createMandat({ ...newMandat, lots: [{ ...lot8, name: "Apt 12" }] })).rejects.toMatchObject({ field: "lots" });
      expect((await snapshot(source)).mandats).toHaveLength(9);
    });

    it("renouvelle pour 3 ans", async () => {
      const source = createDemoSource();
      const renewed = await source.renewMandat("m-2023-0071");
      expect(renewed.endIso).toBe("2029-12-31");
      expect(renewed.status).toBe("actif");
      expect((await snapshot(source)).mandats.find((mandat) => mandat.id === "m-2023-0071")?.endIso).toBe("2029-12-31");
    });

    it("refuse de renouveler un mandat terminé ou inconnu", async () => {
      const source = createDemoSource();
      await expect(source.renewMandat("m-2021-0044")).rejects.toBeInstanceOf(PortefeuilleError);
      await expect(source.renewMandat("inconnu")).rejects.toBeInstanceOf(PortefeuilleError);
    });

    it("résilie une seule fois", async () => {
      const source = createDemoSource();
      const termination = { reason: "accord", effectIso: "2027-02-13", noticeIso: "2026-11-13", note: "" };
      const terminated = await source.terminateMandat("m-2025-0142", termination);
      expect(terminated.termination?.effectIso).toBe("2027-02-13");
      await expect(source.terminateMandat("m-2025-0142", termination)).rejects.toThrow("déjà résilié");
    });
  });

  describe("baux", () => {
    async function withApt8() {
      const source = createDemoSource();
      await source.createMandat(newMandat);
      return source;
    }

    it("crée un bail en cours numéroté et le rend visible", async () => {
      const source = await withApt8();
      const bail = await source.createBail({ ...newBail, startIso: "2026-11-01" });
      expect(bail.status).toBe("en_cours");
      expect(bail.number).toBe("B-2026-032");
      expect((await snapshot(source)).baux.some((item) => item.id === bail.id)).toBe(true);
    });

    it("crée un bail à venir ou un brouillon selon le cas", async () => {
      const source = await withApt8();
      expect((await source.createBail(newBail)).status).toBe("a_venir");
      expect((await (await withApt8()).createBail({ ...newBail, draft: true })).status).toBe("brouillon");
    });

    it("refuse un lot déjà occupé sur la période", async () => {
      const source = createDemoSource();
      await expect(source.createBail({ ...newBail, bienId: "apt-12", locataireId: "chloe-martin" })).rejects.toMatchObject({ field: "startIso" });
    });

    it("refuse un lot ou un locataire inconnu", async () => {
      const source = await withApt8();
      await expect(source.createBail({ ...newBail, bienId: "inconnu" })).rejects.toMatchObject({ field: "bienId" });
      await expect(source.createBail({ ...newBail, locataireId: "inconnu" })).rejects.toMatchObject({ field: "locataireId" });
    });
  });

  describe("patch", () => {
    it("modifie un champ autorisé", async () => {
      const source = createDemoSource();
      await source.patch("locataire", "anais-roux", { email: "anais.nouvelle@example.com" });
      expect((await snapshot(source)).locataires.find((item) => item.id === "anais-roux")?.email).toBe("anais.nouvelle@example.com");
    });

    it("refuse un champ inconnu, une valeur invalide et un élément absent", async () => {
      const source = createDemoSource();
      await expect(source.patch("locataire", "anais-roux", { role: "admin" })).rejects.toBeInstanceOf(PortefeuilleError);
      await expect(source.patch("locataire", "anais-roux", { email: "pas-un-email" })).rejects.toBeInstanceOf(PortefeuilleError);
      await expect(source.patch("locataire", "inconnu", { email: "a@example.com" })).rejects.toThrow("n'existe pas");
      expect((await snapshot(source)).locataires.find((item) => item.id === "anais-roux")?.email).toBe("anais.roux@example.com");
    });

    it("refuse de modifier l'identifiant", async () => {
      await expect(createDemoSource().patch("bail", "b-2024-018", { id: "autre" })).rejects.toBeInstanceOf(PortefeuilleError);
    });
  });
});
