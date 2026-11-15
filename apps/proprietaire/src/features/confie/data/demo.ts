import { buildFiscal, buildReport, buildSettlement } from "./demoFinance";
import type { RentSpec } from "./demoFinance";
import { demoDocuments, demoInterventions } from "./demoOps";
import type { ConfieData, Lot, ScheduleEntry, Settlement } from "./schemas";

export const DEMO_TODAY = "2026-11-13";
const MONTHS_2026 = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11"].map((month) => `2026-${month}`);
const PAYMENT_DAYS: Record<string, string> = { "2026-09": "02", "2026-11": "03" };

function schedule(rent: number, unpaidMonth?: string): ScheduleEntry[] {
  return MONTHS_2026.map((month) => {
    const unpaid = month === unpaidMonth;
    const day = PAYMENT_DAYS[month] ?? "03";
    return {
      month,
      dueOn: `${month}-01`,
      called: rent,
      collected: unpaid ? 0 : rent,
      paidOn: unpaid ? null : `${month}-${day}`,
    };
  });
}

export const demoLots: Lot[] = [
  {
    id: "apt-12",
    label: "Apt 12",
    kind: "T2",
    surface: 38,
    address: "14 rue Vauban, 69006 Lyon",
    floorRank: "3e",
    elevator: true,
    heating: "Individuel, gaz",
    dpe: "D",
    lotNumber: 12,
    rent: { base: 64000, provisions: 6000 },
    tenant: { name: "Thomas Girard", initials: "TG", leaseEndOn: "2027-09-30" },
    lastPaymentOn: "2026-11-03",
    schedule: schedule(70000),
    followUps: [],
  },
  {
    id: "studio-4",
    label: "Studio 4",
    kind: "Studio",
    surface: 21,
    address: "14 rue Vauban, 69006 Lyon",
    floorRank: "1er",
    elevator: false,
    heating: "Électrique",
    dpe: "E",
    lotNumber: 4,
    rent: { base: 41000, provisions: 4000 },
    tenant: { name: "Anaïs Roux", initials: "AR", leaseEndOn: "2027-08-31" },
    lastPaymentOn: "2026-10-03",
    schedule: schedule(45000, "2026-11"),
    followUps: [
      { id: "relance-email", title: "Relance par e-mail envoyée", on: "2026-11-08", detail: "08/11/2026 · Cabinet Delmas Immobilier", state: "done" },
      { id: "relance-courrier", title: "Relance par courrier prévue", on: "2026-11-15", detail: "15/11/2026 si le loyer n'est pas réglé", state: "planned" },
    ],
  },
];

function rentsOf(month: string): RentSpec[] {
  return demoLots.map((lot) => {
    const entry = lot.schedule.find((item) => item.month === month);
    return { lotId: lot.id, called: entry?.called ?? 0, collected: entry?.collected ?? 0 };
  });
}

const WORKS_BY_MONTH: Record<string, number> = { "2026-07": 24000 };

const settlements2026: Settlement[] = MONTHS_2026.map((month) =>
  buildSettlement(month, rentsOf(month), WORKS_BY_MONTH[month] ?? 0, month === "2026-11" ? "pending" : "paid"),
);

const settlements2025Q4: Settlement[] = ["2025-10", "2025-11", "2025-12"].map((month) =>
  buildSettlement(month, [
    { lotId: "apt-12", called: 70000, collected: 70000 },
    { lotId: "studio-4", called: 45000, collected: 45000 },
  ], 0, "paid"),
);

const quarter = (months: readonly string[]) => settlements2026.filter((settlement) => months.includes(settlement.month));
const FULL_COLLECTION = "Taux d'encaissement de 100 % sur le trimestre.";

export const demoReports = [
  buildReport(
    { id: "t4-2026", label: "T4 2026", longLabel: "4e trimestre 2026", span: "En cours", startOn: "2026-10-01", endOn: "2026-12-31", availableOn: "2027-01-05", status: "upcoming", sizeKo: 1, observations: "", arrears: [] },
    [],
  ),
  buildReport(
    {
      id: "t3-2026",
      label: "T3 2026",
      longLabel: "3e trimestre 2026",
      span: "Juillet à septembre",
      startOn: "2026-07-01",
      endOn: "2026-09-30",
      availableOn: "2026-10-05",
      status: "new",
      sizeKo: 186,
      observations: `${FULL_COLLECTION} La régularisation des charges 2026 sera présentée en mars 2027.`,
      works: [
        { title: "Remplacement de la serrure, Apt 12", detail: "Terminée le 18/07/2026 · imputée sur le reversement du 05/08/2026", amount: 24000 },
      ],
      arrears: [
        { title: "Aucun impayé sur le trimestre", detail: "Tous les loyers de juillet à septembre ont été encaissés", tone: "success", badge: "100 %" },
        { title: "Hors période, Studio 4", detail: "Loyer de novembre impayé, 450 € · 12 jours", tone: "danger", badge: "Suivi en cours" },
      ],
    },
    quarter(["2026-07", "2026-08", "2026-09"]),
  ),
  buildReport(
    { id: "t2-2026", label: "T2 2026", longLabel: "2e trimestre 2026", span: "Avril à juin", startOn: "2026-04-01", endOn: "2026-06-30", availableOn: "2026-07-05", status: "viewed", sizeKo: 181, observations: FULL_COLLECTION },
    quarter(["2026-04", "2026-05", "2026-06"]),
  ),
  buildReport(
    { id: "t1-2026", label: "T1 2026", longLabel: "1er trimestre 2026", span: "Janvier à mars", startOn: "2026-01-01", endOn: "2026-03-31", availableOn: "2026-04-05", status: "viewed", sizeKo: 179, observations: FULL_COLLECTION },
    quarter(["2026-01", "2026-02", "2026-03"]),
  ),
  buildReport(
    { id: "t4-2025", label: "T4 2025", longLabel: "4e trimestre 2025", span: "Octobre à décembre", startOn: "2025-10-01", endOn: "2025-12-31", availableOn: "2026-01-05", status: "viewed", sizeKo: 178, observations: FULL_COLLECTION },
    settlements2025Q4,
  ),
];

export function createDemoData(): ConfieData {
  return structuredClone({
    today: DEMO_TODAY,
    profile: {
      denomination: "SCI Chevalier",
      legalForm: "Société civile immobilière",
      siren: "912 345 678",
      representative: "Marc Chevalier",
      representativeRole: "gérant",
      firstName: "Marc",
      taxRegime: "Impôt sur le revenu",
      street: "5 chemin des Vignes",
      postalCode: "69300",
      city: "Caluire-et-Cuire",
      phone: "+33 6 00 00 00 02",
      email: "marc.chevalier@example.com",
      language: "Français",
      payout: { holder: "SCI Chevalier", ibanLast4: "0482", changedOn: "2025-01-15" },
      pendingIbanChange: null,
    },
    agency: {
      name: "Cabinet Delmas Immobilier",
      address: "24 rue de la République, 69002 Lyon",
      phone: "+33 4 00 00 00 03",
      email: "contact@delmas-immobilier.example",
      hours: "Du lundi au vendredi, 9 h à 18 h",
      website: "https://delmas-immobilier.example",
      manager: {
        name: "Sophie Delmas",
        initials: "SD",
        role: "Gestionnaire de votre mandat",
        directPhone: "+33 4 00 00 00 04",
        email: "sophie@delmas-immobilier.example",
      },
      guarantees: [
        { id: "carte-professionnelle", title: "Carte professionnelle, gestion immobilière", detail: "CPI 6901 2019 000 031 842 · valable jusqu'au 30/06/2028", tone: "success", badge: "Valide" },
        { id: "garantie-financiere", title: "Garantie financière", detail: "Fonds des mandants garantis · valable jusqu'au 31/12/2027", tone: "success", badge: "Valide" },
        { id: "assurance-rcp", title: "Assurance responsabilité civile professionnelle", detail: "Échéance le 31/12/2026", tone: "warning", badge: "Renouvellement en cours" },
        { id: "compte-separe", title: "Compte séparé des mandants", detail: "Vos loyers ne sont jamais mélangés aux fonds de l'agence", tone: "success", badge: "Conforme" },
      ],
    },
    mandate: {
      reference: "M-2025-0142",
      signedOn: "2025-01-15",
      startOn: "2025-01-01",
      endOn: "2027-12-31",
      feeRatePercent: 7,
      payoutDay: 5,
      worksThreshold: 30000,
      noticeMonths: 3,
      lotIds: ["apt-12", "studio-4"],
      files: [
        { id: "mandat-signe", title: "Mandat de gestion signé", detail: "PDF · signé le 15/01/2025" },
        { id: "conditions-generales", title: "Conditions générales", detail: "PDF · 12 pages" },
      ],
      endRequest: null,
    },
    lots: demoLots,
    settlements: [...settlements2026],
    reports: demoReports,
    fiscal: buildFiscal(settlements2026, demoLots.length),
    documents: demoDocuments,
    interventions: demoInterventions,
    security: {
      passwordChangedOn: "2026-09-02",
      passwordStrength: "Forte",
      twoFactor: "Application d'authentification",
      backupCodes: 8,
      linkedAccounts: "Google lié · Apple non lié",
      linkedCount: 1,
      devices: 2,
    },
    preferences: [
      { id: "compte-rendu", label: "Nouveau compte rendu de gestion", detail: "Chaque trimestre, le 5 du mois suivant", email: true, push: true },
      { id: "reversement", label: "Reversement effectué", detail: "Le 5 de chaque mois", email: true, push: true },
      { id: "impaye", label: "Loyer impayé", detail: "Dès 5 jours de retard", email: true, push: true },
      { id: "devis", label: "Devis à valider", detail: "Au-delà de 300 € TTC", email: true, push: true },
      { id: "message", label: "Nouveau message de l'agence", detail: "Réponses de votre gestionnaire", email: true, push: false },
      { id: "echeance", label: "Échéance du mandat", detail: "3 mois avant la date d'échéance", email: true, push: false },
    ],
    unreadMessages: 1,
    readNotificationIds: ["reversement-2026-10"],
  });
}
