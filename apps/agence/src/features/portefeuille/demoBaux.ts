import type { ActivityEvent, Bail, InterventionSummary, Locataire, MessageSummary } from "./schemas";
import { slugify } from "./slug";

interface ActiveSeed {
  number: string;
  bienId: string;
  name: string;
  startIso: string;
  endIso: string;
  furnished: boolean;
  rent: number;
  charges: number;
  dueDay?: number;
  overdueSinceIso?: string;
  noticeGiven?: boolean;
  email?: string;
  phone: string;
  bank: string;
  spaceActive?: boolean;
  overrides?: Bail["paymentOverrides"];
}

const activeSeeds: ActiveSeed[] = [
  { number: "B-2024-018", bienId: "apt-12", name: "Thomas Girard", startIso: "2024-09-01", endIso: "2027-08-31", furnished: false, rent: 640, charges: 60, phone: "+33 6 •• •• 18 22", bank: "7741", overrides: { "2026-11": { day: 3 }, "2026-10": { day: 5 }, "2026-09": { day: 3, mode: "prelevement" } } },
  { number: "B-2026-007", bienId: "studio-4", name: "Anaïs Roux", startIso: "2026-04-01", endIso: "2027-03-31", furnished: true, rent: 400, charges: 50, overdueSinceIso: "2026-11-01", phone: "+33 6 •• •• 47 03", bank: "5530", overrides: { "2026-10": { day: 2 }, "2026-09": { day: 2 } } },
  { number: "B-2025-009", bienId: "apt-3", name: "Julie Marchand", startIso: "2025-03-01", endIso: "2028-02-28", furnished: false, rent: 1360, charges: 120, phone: "+33 6 •• •• 61 09", bank: "2284" },
  { number: "B-2026-004", bienId: "apt-7", name: "Louis Petit", startIso: "2026-04-19", endIso: "2027-04-18", furnished: true, rent: 460, charges: 50, dueDay: 19, overdueSinceIso: "2026-10-19", phone: "+33 6 •• •• 75 40", bank: "6619" },
  { number: "B-2025-021", bienId: "apt-9", name: "Karim Haddad", startIso: "2025-09-15", endIso: "2028-09-14", furnished: false, rent: 1260, charges: 110, phone: "+33 6 •• •• 02 87", bank: "3150" },
  { number: "B-2025-013", bienId: "maison-les-pins", name: "Éric Fabre", startIso: "2025-06-01", endIso: "2028-05-31", furnished: false, rent: 1000, charges: 100, phone: "+33 6 •• •• 94 16", bank: "8023" },
  { number: "B-2026-016", bienId: "apt-5", name: "Inès Laurent", startIso: "2026-09-01", endIso: "2027-08-31", furnished: true, rent: 680, charges: 60, phone: "+33 7 •• •• 25 71", bank: "4466", spaceActive: false },
  { number: "B-2025-005", bienId: "lot-1", name: "Camille Dupuis", startIso: "2025-02-01", endIso: "2031-01-31", furnished: false, rent: 1140, charges: 110, phone: "+33 6 •• •• 39 58", bank: "1907" },
  { number: "B-2024-029", bienId: "lot-2", name: "Yann Morel", startIso: "2024-10-01", endIso: "2030-09-30", furnished: false, rent: 1360, charges: 120, phone: "+33 6 •• •• 80 13", bank: "5072" },
  { number: "B-2026-010", bienId: "lot-3", name: "Sarah Mensah", startIso: "2026-05-05", endIso: "2027-05-04", furnished: true, rent: 260, charges: 40, dueDay: 5, overdueSinceIso: "2026-11-05", phone: "+33 7 •• •• 17 92", bank: "9238" },
  { number: "B-2023-017", bienId: "lot-4", name: "Olivier Blanc", startIso: "2023-06-01", endIso: "2029-05-31", furnished: false, rent: 1110, charges: 110, phone: "+33 6 •• •• 56 34", bank: "6405" },
  { number: "B-2024-031", bienId: "apt-2", name: "Hugo Perrin", startIso: "2024-12-01", endIso: "2027-11-30", furnished: false, rent: 700, charges: 60, phone: "+33 6 •• •• 21 77", bank: "7812" },
  { number: "B-2024-003", bienId: "apt-6", name: "Léa Vidal", startIso: "2024-02-01", endIso: "2027-01-31", furnished: false, rent: 600, charges: 60, noticeGiven: true, phone: "+33 6 •• •• 68 45", bank: "2593" },
  { number: "B-2026-001", bienId: "maison-de-ville", name: "Mathieu Garnier", startIso: "2026-01-01", endIso: "2028-12-31", furnished: false, rent: 1080, charges: 100, phone: "+33 6 •• •• 33 06", bank: "1148" },
];

interface PastSeed {
  number: string;
  bienId: string;
  name: string;
  startIso: string;
  endIso: string;
  furnished: boolean;
  rent: number;
  charges: number;
}

const pastSeeds: PastSeed[] = [
  { number: "B-2021-011", bienId: "apt-12", name: "Pauline Lefort", startIso: "2021-09-01", endIso: "2024-08-31", furnished: false, rent: 600, charges: 55 },
  { number: "B-2024-009", bienId: "studio-4", name: "Julien Roche", startIso: "2024-04-01", endIso: "2026-03-31", furnished: true, rent: 390, charges: 45 },
  { number: "B-2022-014", bienId: "apt-3", name: "Claire Dubois", startIso: "2022-03-01", endIso: "2025-02-28", furnished: false, rent: 1300, charges: 110 },
  { number: "B-2023-020", bienId: "apt-7", name: "Nicolas Faure", startIso: "2023-09-01", endIso: "2026-04-18", furnished: true, rent: 440, charges: 45 },
  { number: "B-2023-008", bienId: "lot-3", name: "Emma Rolland", startIso: "2023-05-05", endIso: "2026-05-04", furnished: true, rent: 240, charges: 35 },
  { number: "B-2022-003", bienId: "lot-1", name: "Antoine Perret", startIso: "2022-02-01", endIso: "2025-01-31", furnished: false, rent: 1080, charges: 100 },
  { number: "B-2023-019", bienId: "apt-5", name: "Sophie Bernier", startIso: "2023-09-01", endIso: "2026-08-31", furnished: true, rent: 650, charges: 55 },
  { number: "B-2021-022", bienId: "apt-2", name: "Marion Colin", startIso: "2021-12-01", endIso: "2024-11-30", furnished: false, rent: 660, charges: 55 },
  { number: "B-2022-012", bienId: "maison-de-ville", name: "Théo Marchal", startIso: "2022-01-01", endIso: "2025-12-31", furnished: false, rent: 1020, charges: 95 },
];

function emailOf(name: string): string {
  const [first = "", ...rest] = slugify(name).split("-");
  return `${first}.${rest.join("-")}@example.com`;
}

function cents(euros: number): number {
  return euros * 100;
}

const activeBaux: Bail[] = activeSeeds.map((seed) => ({
  id: slugify(seed.number),
  number: seed.number,
  bienId: seed.bienId,
  locataireId: slugify(seed.name),
  status: "en_cours",
  furnished: seed.furnished,
  startIso: seed.startIso,
  endIso: seed.endIso,
  rentMinor: cents(seed.rent),
  chargesMinor: cents(seed.charges),
  depositMinor: cents(seed.furnished ? seed.rent * 2 : seed.rent),
  dueDay: seed.dueDay ?? 1,
  paymentMode: "virement",
  noticeGiven: seed.noticeGiven ?? false,
  ...(seed.overdueSinceIso ? { overdueSinceIso: seed.overdueSinceIso } : {}),
  ...(seed.overrides ? { paymentOverrides: seed.overrides } : {}),
}));

const pastBaux: Bail[] = pastSeeds.map((seed) => ({
  id: slugify(seed.number),
  number: seed.number,
  bienId: seed.bienId,
  locataireId: slugify(seed.name),
  status: "termine",
  furnished: seed.furnished,
  startIso: seed.startIso,
  endIso: seed.endIso,
  rentMinor: cents(seed.rent),
  chargesMinor: cents(seed.charges),
  depositMinor: cents(seed.furnished ? seed.rent * 2 : seed.rent),
  dueDay: 1,
  paymentMode: "virement",
  noticeGiven: false,
}));

const draftBail: Bail = {
  id: "b-2026-022",
  number: "B-2026-022",
  bienId: "apt-2",
  locataireId: "hugo-perrin",
  status: "brouillon",
  furnished: false,
  startIso: "2027-12-01",
  endIso: "2030-11-30",
  rentMinor: cents(720),
  chargesMinor: cents(60),
  depositMinor: cents(720),
  dueDay: 1,
  paymentMode: "virement",
  noticeGiven: false,
  note: "Renouvellement à l'échéance, loyer révisé.",
};

export const demoBaux: Bail[] = [...activeBaux, draftBail, ...pastBaux];

export const demoLocataires: Locataire[] = [
  ...activeSeeds.map((seed) => ({
    id: slugify(seed.name),
    name: seed.name,
    email: emailOf(seed.name),
    phoneMasked: seed.phone,
    bankLast4: seed.bank,
    spaceActive: seed.spaceActive ?? true,
    archived: false,
  })),
  { id: "chloe-martin", name: "Chloé Martin", email: "chloe.martin@example.com", phoneMasked: "+33 6 •• •• 90 14", bankLast4: "3361", spaceActive: false, archived: false },
  ...pastSeeds.map((seed) => ({
    id: slugify(seed.name),
    name: seed.name,
    email: emailOf(seed.name),
    phoneMasked: "+33 6 •• •• 00 00",
    bankLast4: "0000",
    spaceActive: false,
    archived: true,
  })),
];

export const demoEvents: ActivityEvent[] = [
  { id: "e1", kind: "mandat", subjectId: "m-2025-0142", dateIso: "2026-11-05", title: "Reversement d'octobre exécuté", detail: "1 069,50 €", tone: "success" },
  { id: "e2", kind: "mandat", subjectId: "m-2025-0142", dateIso: "2026-11-10", title: "Relance envoyée, Studio 4", detail: "Sophie Delmas", tone: "warning" },
  { id: "e3", kind: "mandat", subjectId: "m-2025-0142", dateIso: "2025-01-15", title: "Mandat signé", detail: "Signature électronique", tone: "neutral" },
  { id: "e4", kind: "mandat", subjectId: "m-2025-0142", dateIso: "2026-10-05", title: "Reversement de septembre exécuté", detail: "1 069,50 €", tone: "success" },
  { id: "e5", kind: "mandat", subjectId: "m-2025-0142", dateIso: "2025-01-10", title: "Attestation de garantie financière ajoutée", detail: "Valable jusqu'au 31/12/2027", tone: "neutral" },
  { id: "e6", kind: "bail", subjectId: "b-2024-018", dateIso: "2026-10-05", title: "Quittance d'octobre envoyée", detail: "Cabinet Delmas", tone: "neutral" },
  { id: "e7", kind: "bail", subjectId: "b-2024-018", dateIso: "2026-09-01", title: "Révision du loyer appliquée", detail: "630 € → 640 €, IRL +1,6 %", tone: "info" },
  { id: "e8", kind: "bail", subjectId: "b-2024-018", dateIso: "2024-08-22", title: "Bail signé", detail: "Signature électronique", tone: "neutral" },
  { id: "e9", kind: "locataire", subjectId: "anais-roux", dateIso: "2026-11-12", title: "Message du locataire", detail: "« Je règle le 15/11 »", tone: "warning", badge: "À répondre" },
  { id: "e10", kind: "locataire", subjectId: "anais-roux", dateIso: "2026-11-10", title: "Deuxième relance, grand livre joint", detail: "E-mail et SMS · Sophie Delmas", tone: "neutral" },
  { id: "e11", kind: "locataire", subjectId: "anais-roux", dateIso: "2026-11-01", title: "Échéance de novembre non réglée", detail: "450 € dus depuis le 01/11/2026", tone: "danger", badge: "Impayé" },
  { id: "e12", kind: "mandant", subjectId: "marc-chevalier", dateIso: "2026-11-05", title: "Reversement d'octobre exécuté", detail: "1 069,50 €", tone: "success" },
  { id: "e13", kind: "mandant", subjectId: "marc-chevalier", dateIso: "2025-01-15", title: "Mandat signé", detail: "Signature électronique", tone: "neutral" },
  { id: "e14", kind: "bien", subjectId: "apt-12", dateIso: "2026-11-03", title: "Loyer de novembre encaissé", detail: "700,00 € par virement", tone: "success" },
  { id: "e15", kind: "bien", subjectId: "apt-12", dateIso: "2026-09-12", title: "Joint de fenêtre remplacé", detail: "85 €, réglé par le mandant", tone: "neutral" },
];

export const demoInterventions: InterventionSummary[] = [
  { id: "i1", bienId: "apt-12", title: "Remplacement du joint de fenêtre", dateIso: "2026-09-12", amountMinor: 8_500, note: "réglé par le mandant", done: true },
  { id: "i2", bienId: "apt-12", title: "Entretien annuel de la chaudière", dateIso: "2026-06-20", amountMinor: 11_200, note: "", done: true },
];

export const demoMessages: MessageSummary[] = [
  { id: "ms1", locataireId: "anais-roux", title: "Je règle le 15/11", dateIso: "2026-11-12", from: "Anaïs Roux", state: "a_repondre" },
  { id: "ms2", locataireId: "anais-roux", title: "Relance, loyer de novembre", dateIso: "2026-11-10", from: "Cabinet Delmas", state: "envoye" },
  { id: "ms3", locataireId: "anais-roux", title: "Quittance d'octobre", dateIso: "2026-10-05", from: "Cabinet Delmas", state: "envoye" },
];
