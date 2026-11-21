import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DEMO_TODAY } from "@/features/shared/dates";
import { formatMoney } from "@/features/shared/money";
import { mandantStatementSchema } from "@/features/shared/statement";
import { createFinancesDemo } from "./demo";
import { baremesSchema, encaissementsSchema, honorairesSchema, impayeDetailSchema, impayesSchema, lotSchema, openInstallmentsSchema, paymentPreviewSchema, reversementDetailSchema, reversementsSchema, simulationSchema } from "./schemas";

const anyString: unknown = expect.any(String);

const baremeInput = {
  mandateId: "M-2025-0142",
  rateBp: 800,
  base: "rent_and_charges",
  minFeeMinor: 0,
  lettingBp: 5000,
  worksBp: 500,
  effectiveFrom: "2026-12-01",
} as const;

function paymentInput(overrides: Partial<Parameters<ReturnType<typeof createFinancesDemo>["recordPayment"]>[0]> = {}) {
  return {
    idempotencyKey: "cle-test-0001",
    installmentId: "studio-4-2026-11",
    amountMinor: 45000,
    receivedOn: "2026-11-13",
    mode: "virement",
    reference: "VIR 13/11 ROUX STUDIO 4",
    note: "",
    receipt: true,
    notifyTenant: true,
    notifyMandant: false,
    ...overrides,
  } as const;
}

describe("chiffres de la maquette", () => {
  it("encaissements de novembre", async () => {
    const data = encaissementsSchema.parse(await createFinancesDemo().encaissements("2026-11"));
    expect(data.payments).toHaveLength(11);
    expect(data.calledMinor).toBe(1_320_000);
    expect(data.collectedMinor).toBe(1_194_000);
    expect(data.feeMinor).toBe(83_580);
    expect(data.remainingMinor).toBe(126_000);
    expect(data.unpaidCount).toBe(3);
    expect(data.payments.filter((payment) => payment.status === "a_rapprocher")).toHaveLength(1);
    expect(data.rateLabel).toBe("7 % TTC des loyers encaissés");
  });

  it("impayés", async () => {
    const data = impayesSchema.parse(await createFinancesDemo().impayes());
    expect(data.rows.map((row) => [row.tenantName, row.remainingMinor, row.overdueDays, row.nextStep.label])).toEqual([
      ["Louis Petit", 51_000, 25, "Mise en demeure à envoyer"],
      ["Anaïs Roux", 45_000, 12, "Mise en demeure le 16/11/2026"],
      ["Sarah Mensah", 30_000, 8, "Deuxième relance le 16/11/2026"],
    ]);
    expect([data.totalMinor, data.mandantsCount, data.over20Minor, data.over20Label, data.remindersThisMonth, data.remindersCases]).toEqual([126_000, 3, 51_000, "Apt 7, Louis Petit", 5, 3]);
  });

  it("reversements", async () => {
    const data = reversementsSchema.parse(await createFinancesDemo().reversements());
    expect(data.rows.map((row) => [row.name, row.collectedMinor, row.feeMinor, row.netMinor])).toEqual([
      ["Marc Chevalier", 70_000, 4_900, 65_100],
      ["Famille Bernard", 285_000, 19_950, 265_050],
      ["Hélène Roussel", 184_000, 12_880, 171_120],
      ["SCI Les Acacias", 395_000, 27_650, 367_350],
      ["Paul Lemoine", 142_000, 9_940, 132_060],
      ["Nadia Benali", 118_000, 8_260, 109_740],
    ]);
    expect(data.rows.reduce((total, row) => total + row.netMinor, 0)).toBe(1_110_420);
    expect(data.unpaid).toEqual({ count: 3, totalMinor: 126_000, labels: ["Studio 4", "Apt 7", "Lot 3"] });
    expect(data.lastBatch).toEqual({ executedOn: "2026-11-05", periodLabel: "Octobre", count: 6, executed: true });
    expect(data.history.filter((row) => row.mandantId === "marc-chevalier")).toHaveLength(14);
  });

  it("détail du reversement de Marc Chevalier", async () => {
    const detail = reversementDetailSchema.parse(await createFinancesDemo().reversement("marc-chevalier"));
    expect(detail).toMatchObject({ calledMinor: 115_000, collectedMinor: 70_000, feeMinor: 4_900, htMinor: 4_083, vatMinor: 817, netMinor: 65_100, pendingFeeMinor: 3_150 });
    expect(detail?.history[0]).toMatchObject({ period: "2026-10", feeMinor: 8_050, netMinor: 106_950 });
  });

  it("honoraires de novembre", async () => {
    const data = honorairesSchema.parse(await createFinancesDemo().honoraires("2026-11"));
    expect([data.feeMinor, data.htMinor, data.vatMinor, data.pendingMinor, data.collectedMinor, data.unpaidCount]).toEqual([83_580, 69_650, 13_930, 8_820, 1_194_000, 3]);
    expect(data.rows.map((row) => row.pendingMinor)).toEqual([3_150, 3_570, 0, 2_100, 0, 0]);
    expect(data.scheme.sameRateCount).toBe(6);
  });

  it("fiche d'impayé de Studio 4", async () => {
    const detail = impayeDetailSchema.nullable().parse(await createFinancesDemo().impayeDetail("studio-4"));
    expect(detail).toMatchObject({ remainingMinor: 45_000, pendingFeeMinor: 3_150, depositMinor: 80_000, reminders: 2, lastReminderOn: "2026-11-10" });
    expect(detail?.impact).toEqual({ lotsLabel: "Apt 12", rateBp: 700, collectedMinor: 70_000, feeMinor: 4_900, netMinor: 65_100 });
    expect(detail?.events.at(-1)).toMatchObject({ planned: true, title: "Mise en demeure par courrier recommandé" });
  });
});

describe("contrat des relevés pour les comptes rendus", () => {
  it("renvoie six relevés valides pour novembre", async () => {
    const statements = z.array(mandantStatementSchema).parse(await createFinancesDemo().statements("2026-11"));
    expect(statements).toHaveLength(6);
    const marc = statements.find((statement) => statement.mandantId === "marc-chevalier");
    expect(marc).toMatchObject({ calledMinor: 115_000, collectedMinor: 70_000, feeMinor: 4_900, netMinor: 65_100, transferDate: "2026-12-05", ibanLast4: "2031", mandateRef: "M-2025-0142", receipts: 1 });
    expect(marc?.lines.find((line) => line.lotId === "studio-4")).toMatchObject({ collectedMinor: 0, paidOn: null, unpaidSince: "2026-11-01", reminders: 2 });
    expect(statements.reduce((total, statement) => total + statement.netMinor, 0)).toBe(1_110_420);
  });

  it("ne renvoie rien pour une période sans échéances", async () => {
    expect(await createFinancesDemo().statements("2030-01")).toEqual([]);
  });
});

describe("saisie d'un paiement", () => {
  it("calcule les honoraires côté serveur, clôt l'impayé et met à jour le reversement", async () => {
    const source = createFinancesDemo();
    const result = await source.recordPayment(paymentInput());
    expect(result).toMatchObject({ remainingAfterMinor: 0, feeMinor: 3_150, closedCase: true });
    expect((impayesSchema.parse(await source.impayes())).rows.map((row) => row.lotId)).toEqual(["apt-7", "lot-3"]);
    expect(await source.impayeDetail("studio-4")).toBeNull();
    const marc = reversementDetailSchema.parse(await source.reversement("marc-chevalier"));
    expect([marc?.collectedMinor, marc?.feeMinor, marc?.netMinor]).toEqual([115_000, 8_050, 106_950]);
  });

  it("refuse un montant supérieur au reste dû sans rien enregistrer", async () => {
    const source = createFinancesDemo();
    await expect(source.recordPayment(paymentInput({ amountMinor: 45_001 }))).rejects.toMatchObject({ fieldErrors: { amountMinor: `Le montant dépasse le reste dû (${formatMoney(45_000)}).` } });
    expect(encaissementsSchema.parse(await source.encaissements("2026-11")).payments).toHaveLength(11);
  });

  it("refuse une date de réception future", async () => {
    await expect(createFinancesDemo().recordPayment(paymentInput({ receivedOn: "2026-11-20" }))).rejects.toMatchObject({ fieldErrors: { receivedOn: anyString } });
  });

  it("est idempotent : rejouer la même clé ne crée qu'un paiement", async () => {
    const source = createFinancesDemo();
    const first = await source.recordPayment(paymentInput({ amountMinor: 20_000 }));
    const second = await source.recordPayment(paymentInput({ amountMinor: 20_000 }));
    expect(second).toEqual(first);
    expect(encaissementsSchema.parse(await source.encaissements("2026-11")).payments).toHaveLength(12);
  });

  it("un paiement partiel laisse l'impayé ouvert", async () => {
    const source = createFinancesDemo();
    const result = await source.recordPayment(paymentInput({ amountMinor: 20_000, mode: "cheque" }));
    expect(result).toMatchObject({ remainingAfterMinor: 25_000, closedCase: false });
    expect(impayesSchema.parse(await source.impayes()).rows.find((row) => row.lotId === "studio-4")?.remainingMinor).toBe(25_000);
  });

  it("l'aperçu est calculé par le serveur", async () => {
    const source = createFinancesDemo();
    const preview = paymentPreviewSchema.parse(await source.previewPayment({ installmentId: "studio-4-2026-11", amountMinor: 45_000, receivedOn: "2026-11-13" }));
    expect(preview).toMatchObject({ error: null, feeMinor: 3_150, netMinor: 41_850, remainingAfterMinor: 0, closesCase: true, mandantName: "Marc Chevalier" });
    const tooMuch = paymentPreviewSchema.parse(await source.previewPayment({ installmentId: "studio-4-2026-11", amountMinor: 99_999, receivedOn: "2026-11-13" }));
    expect(tooMuch.error).toContain("dépasse le reste dû");
    expect(openInstallmentsSchema.parse(await source.openInstallments()).map((item) => item.lotId)).toEqual(["apt-7", "studio-4", "lot-3"]);
  });

  it("le rejet d'un paiement le retire du reversement et rouvre un impayé", async () => {
    const source = createFinancesDemo();
    await source.rejectPayment({ paymentId: "pay-nov-apt-12", reason: "Chèque sans provision" });
    const impayes = impayesSchema.parse(await source.impayes());
    expect(impayes.rows.map((row) => row.lotId)).toContain("apt-12");
    expect(impayes.totalMinor).toBe(196_000);
    const marc = reversementDetailSchema.parse(await source.reversement("marc-chevalier"));
    expect([marc?.collectedMinor, marc?.netMinor]).toEqual([0, 0]);
    expect(impayeDetailSchema.parse(await source.impayeDetail("apt-12")).events.at(-1)).toMatchObject({ kind: "rejet" });
    await expect(source.reconcilePayment({ paymentId: "pay-nov-apt-12" })).rejects.toMatchObject({ code: "paiement_rejete" });
  });

  it("rapprocher un chèque le passe en reçu", async () => {
    const source = createFinancesDemo();
    await source.reconcilePayment({ paymentId: "pay-nov-apt-5" });
    const row = encaissementsSchema.parse(await source.encaissements("2026-11")).payments.find((payment) => payment.id === "pay-nov-apt-5");
    expect(row?.status).toBe("recu");
  });
});

describe("relances et échéancier", () => {
  it("une relance ajoute un événement et incrémente le compteur", async () => {
    const source = createFinancesDemo();
    await source.sendReminders({ lotIds: ["lot-3"], channel: "sms", message: "Bonjour, votre loyer de novembre reste à régler." });
    const detail = impayeDetailSchema.parse(await source.impayeDetail("lot-3"));
    expect(detail).toMatchObject({ reminders: 2, lastReminderOn: "2026-11-13" });
    expect(detail.nextStep.label).toBe("Mise en demeure le 19/11/2026");
    await expect(source.sendReminders({ lotIds: ["apt-12"], channel: "email", message: "Bonjour, votre loyer reste à régler." })).rejects.toMatchObject({ code: "dossier_introuvable" });
  });

  it("l'échéancier répartit le reste dû en mensualités entières", async () => {
    const source = createFinancesDemo();
    await source.proposePlan({ lotId: "apt-7", installments: 4, firstDueOn: "2026-12-01" });
    const detail = impayeDetailSchema.parse(await source.impayeDetail("apt-7"));
    expect(detail.plan?.lines).toEqual([
      { dueOn: "2026-12-01", amountMinor: 12_750 },
      { dueOn: "2027-01-01", amountMinor: 12_750 },
      { dueOn: "2027-02-01", amountMinor: 12_750 },
      { dueOn: "2027-03-01", amountMinor: 12_750 },
    ]);
    await expect(source.proposePlan({ lotId: "apt-7", installments: 7, firstDueOn: "2026-12-01" })).rejects.toMatchObject({ fieldErrors: { installments: anyString } });
    await expect(source.proposePlan({ lotId: "apt-7", installments: 3, firstDueOn: "2026-11-01" })).rejects.toMatchObject({ fieldErrors: { firstDueOn: anyString } });
  });

  it("la mise en demeure est tracée une seule fois", async () => {
    const source = createFinancesDemo();
    await source.prepareNotice({ lotId: "apt-7" });
    await source.prepareNotice({ lotId: "apt-7" });
    const detail = impayeDetailSchema.parse(await source.impayeDetail("apt-7"));
    expect(detail.events.filter((event) => event.kind === "mise_en_demeure")).toHaveLength(1);
    expect(detail.nextStep.label).toBe("Mise en demeure envoyée le 13/11/2026");
  });
});

describe("lot de virements", () => {
  it("prépare un brouillon avec les six mandants", async () => {
    const source = createFinancesDemo();
    expect(lotSchema.parse(await source.lot())).toBeNull();
    await source.prepareLot();
    await source.prepareLot();
    const lot = lotSchema.parse(await source.lot());
    expect(lot).toMatchObject({ status: "brouillon", totalMinor: 1_110_420, feesMinor: 83_580, retainedMinor: 0, lotsCount: 14, executionOn: "2026-12-05" });
    expect(lot?.transfers).toHaveLength(6);
    expect(lot?.transfers[0]?.label).toBe("Loyers 11/2026, M-2025-0142");
  });

  it("valide une seule fois : la même clé rejouée donne le même résultat", async () => {
    const source = createFinancesDemo();
    await source.prepareLot();
    const first = await source.validateLot({ batchId: "lot-2026-11", idempotencyKey: "cle-lot-0001" });
    const second = await source.validateLot({ batchId: "lot-2026-11", idempotencyKey: "cle-lot-0001" });
    expect(first).toMatchObject({ transfersCount: 6, totalMinor: 1_110_420, replayed: false });
    expect(second).toMatchObject({ transfersCount: 6, totalMinor: 1_110_420, replayed: true });
    const data = reversementsSchema.parse(await source.reversements());
    expect(data.history.filter((row) => row.period === "2026-11")).toHaveLength(6);
    expect(data.rows.every((row) => row.status === "reverse")).toBe(true);
    await expect(source.validateLot({ batchId: "lot-2026-11", idempotencyKey: "cle-lot-0002" })).rejects.toMatchObject({ code: "lot_deja_valide" });
  });

  it("retirer un mandant, bloquer, débloquer et inclure à nouveau", async () => {
    const source = createFinancesDemo();
    await source.prepareLot();
    await source.removeFromLot({ batchId: "lot-2026-11", mandantId: "paul-lemoine" });
    expect(lotSchema.parse(await source.lot())?.transfers).toHaveLength(5);
    await source.includeInLot({ mandantId: "paul-lemoine" });
    expect(lotSchema.parse(await source.lot())?.transfers).toHaveLength(6);
    await source.blockReversement({ mandantId: "paul-lemoine", reason: "Mandat à renouveler" });
    const blocked = lotSchema.parse(await source.lot());
    expect(blocked?.transfers).toHaveLength(5);
    expect(blocked?.excluded).toEqual([{ mandantId: "paul-lemoine", name: "Paul Lemoine", reason: "Reversement bloqué : Mandat à renouveler", canInclude: false }]);
    await expect(source.includeInLot({ mandantId: "paul-lemoine" })).rejects.toMatchObject({ code: "reversement_bloque" });
    await source.unblockReversement({ mandantId: "paul-lemoine" });
    await source.includeInLot({ mandantId: "paul-lemoine" });
    expect(lotSchema.parse(await source.lot())?.transfers).toHaveLength(6);
  });

  it("inclure un mandant sans lot en crée un avec lui seul", async () => {
    const source = createFinancesDemo();
    await source.includeInLot({ mandantId: "marc-chevalier" });
    const lot = lotSchema.parse(await source.lot());
    expect(lot?.transfers.map((transfer) => transfer.mandantId)).toEqual(["marc-chevalier"]);
    expect(lot?.totalMinor).toBe(65_100);
  });
});

describe("barème", () => {
  it("la simulation porte sur le dernier mois clos, calculée côté serveur", async () => {
    const simulation = simulationSchema.parse(await createFinancesDemo().simulateBareme(baremeInput));
    expect(simulation).toEqual({ periodLabel: "Octobre 2026", collectedMinor: 115_000, currentRateBp: 700, currentFeeMinor: 8_050, newFeeMinor: 9_200, differenceMinor: 1_150 });
  });

  it("l'enregistrement crée une version à signer, par mandat, qui ne s'applique pas avant son entrée en vigueur", async () => {
    const source = createFinancesDemo();
    const saved = await source.saveBareme(baremeInput);
    expect(saved).toEqual({ mandantName: "Marc Chevalier", mandateRef: "M-2025-0142", effectiveFrom: "2026-12-01" });
    const fees = honorairesSchema.parse(await source.honoraires("2026-11"));
    expect(fees.feeMinor).toBe(83_580);
    expect(fees.scheme.upcoming).toEqual([{ mandantName: "Marc Chevalier", rateBp: 800, effectiveFrom: "2026-12-01" }]);
    const entries = baremesSchema.parse(await source.baremes());
    expect(entries[0]).toMatchObject({ mandateId: "M-2025-0142", current: { rateBp: 700 } });
    expect(entries.filter((entry) => entry.current.rateBp === 800)).toHaveLength(0);
  });

  it("n'agit que sur le mandat choisi et refuse un mandat inconnu", async () => {
    const source = createFinancesDemo();
    await source.saveBareme(baremeInput);
    const fees = honorairesSchema.parse(await source.honoraires("2026-11"));
    expect(fees.scheme.upcoming).toHaveLength(1);
    await expect(source.saveBareme({ ...baremeInput, mandateId: "M-0000-0000" })).rejects.toMatchObject({ fieldErrors: { mandateId: anyString } });
  });

  it("refuse une entrée en vigueur passée mais accepte aujourd'hui", async () => {
    const source = createFinancesDemo();
    await expect(source.saveBareme({ ...baremeInput, effectiveFrom: "2026-11-01" })).rejects.toMatchObject({ fieldErrors: { effectiveFrom: anyString } });
    await expect(source.saveBareme({ ...baremeInput, effectiveFrom: DEMO_TODAY })).resolves.toMatchObject({ effectiveFrom: DEMO_TODAY });
  });

  it("refuse une base de calcul hors du contrat serveur", async () => {
    const source = createFinancesDemo();
    await expect(source.saveBareme({ ...baremeInput, base: "encaisses" } as never)).rejects.toBeDefined();
  });
});
