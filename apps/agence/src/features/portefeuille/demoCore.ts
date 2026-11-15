import type { Bien, ComplianceItem, Mandant, Mandat } from "./schemas";
import { slugify } from "./slug";

export const demoMandants: Mandant[] = [
  {
    id: "marc-chevalier",
    name: "Marc Chevalier",
    legal: "SCI Chevalier",
    type: "societe",
    sinceIso: "2025-01-15",
    email: "marc.chevalier@example.com",
    phoneMasked: "+33 6 •• •• 20 31",
    address: "4 quai Saint-Antoine, Lyon",
    ibanLast4: "2031",
    ownerSpaceActive: true,
    reportsByEmail: true,
  },
  {
    id: "famille-bernard",
    name: "Famille Bernard",
    legal: "Indivision",
    type: "indivision",
    sinceIso: "2024-04-01",
    email: "famille.bernard@example.com",
    phoneMasked: "+33 6 •• •• 58 12",
    address: "8 place Bellecour, Lyon",
    ibanLast4: "4417",
    ownerSpaceActive: true,
    reportsByEmail: true,
  },
  {
    id: "helene-roussel",
    name: "Hélène Roussel",
    legal: "Particulier",
    type: "particulier",
    sinceIso: "2024-01-01",
    email: "helene.roussel@example.com",
    phoneMasked: "+33 6 •• •• 33 90",
    address: "27 rue de la Charité, Lyon",
    ibanLast4: "8820",
    ownerSpaceActive: true,
    reportsByEmail: false,
  },
  {
    id: "sci-les-acacias",
    name: "SCI Les Acacias",
    legal: "Société civile",
    type: "societe",
    sinceIso: "2023-04-01",
    email: "gestion@sci-les-acacias.example.com",
    phoneMasked: "+33 4 •• •• 71 05",
    address: "17 avenue des Acacias, Villeurbanne",
    ibanLast4: "1156",
    ownerSpaceActive: true,
    reportsByEmail: true,
  },
  {
    id: "paul-lemoine",
    name: "Paul Lemoine",
    legal: "Particulier",
    type: "particulier",
    sinceIso: "2024-02-01",
    email: "paul.lemoine@example.com",
    phoneMasked: "+33 6 •• •• 12 64",
    address: "3 rue Sainte-Hélène, Lyon",
    ibanLast4: "9042",
    ownerSpaceActive: false,
    reportsByEmail: true,
  },
  {
    id: "nadia-benali",
    name: "Nadia Benali",
    legal: "Particulier",
    type: "particulier",
    sinceIso: "2025-07-01",
    email: "nadia.benali@example.com",
    phoneMasked: "+33 7 •• •• 46 28",
    address: "12 rue Pierre Corneille, Lyon",
    ibanLast4: "3375",
    ownerSpaceActive: true,
    reportsByEmail: true,
  },
];

const base = { feeBasisPoints: 700, payoutDay: 5, worksLimitMinor: 50_000, renewal: "aucune" as const, signed: true };

export const demoMandats: Mandat[] = [
  { ...base, id: "m-2025-0142", number: "M-2025-0142", mandantId: "marc-chevalier", status: "actif", startIso: "2025-01-15", endIso: "2027-12-31", guaranteeUntilIso: "2027-12-31" },
  { ...base, id: "m-2024-0058", number: "M-2024-0058", mandantId: "famille-bernard", status: "actif", startIso: "2024-04-01", endIso: "2027-03-31", guaranteeUntilIso: "2027-12-31" },
  { ...base, id: "m-2023-0071", number: "M-2023-0071", mandantId: "helene-roussel", status: "a_renouveler", startIso: "2024-01-01", endIso: "2026-12-31", guaranteeUntilIso: "2027-12-31" },
  { ...base, id: "m-2022-0019", number: "M-2022-0019", mandantId: "sci-les-acacias", status: "actif", startIso: "2023-04-01", endIso: "2028-03-31", guaranteeUntilIso: "2027-12-31" },
  { ...base, id: "m-2024-0033", number: "M-2024-0033", mandantId: "paul-lemoine", status: "a_renouveler", startIso: "2024-02-01", endIso: "2027-01-31", guaranteeUntilIso: "2027-12-31" },
  { ...base, id: "m-2025-0201", number: "M-2025-0201", mandantId: "nadia-benali", status: "actif", startIso: "2025-07-01", endIso: "2028-06-30", guaranteeUntilIso: "2027-12-31" },
  { ...base, id: "m-2021-0044", number: "M-2021-0044", mandantId: "famille-bernard", status: "termine", startIso: "2021-04-01", endIso: "2024-03-31", guaranteeUntilIso: "2024-12-31" },
  { ...base, id: "m-2020-0008", number: "M-2020-0008", mandantId: "sci-les-acacias", status: "termine", startIso: "2020-04-01", endIso: "2023-03-31", guaranteeUntilIso: "2023-12-31" },
  { ...base, id: "m-2021-0012", number: "M-2021-0012", mandantId: "paul-lemoine", status: "termine", startIso: "2021-02-01", endIso: "2024-01-31", guaranteeUntilIso: "2024-12-31" },
];

type BienSeed = readonly [string, string, string, number, string, string, string, string, string, string, string, string];

const bienSeeds: BienSeed[] = [
  ["Apt 12", "T2", "m-2025-0142", 38, "14 rue de la République", "69002", "Lyon", "3e sur 5, ascenseur", "C, valable jusqu'en 2034", "Individuel, gaz", "Cabinet Lefèvre", "2026-12-31"],
  ["Studio 4", "Studio", "m-2025-0142", 21, "5 rue Vendôme", "69006", "Lyon", "1er sur 4, sans ascenseur", "D, valable jusqu'en 2033", "Électrique", "Cabinet Lefèvre", "2026-12-31"],
  ["Apt 3", "T4", "m-2024-0058", 82, "22 cours Gambetta", "69007", "Lyon", "2e sur 6, ascenseur", "C, valable jusqu'en 2035", "Collectif, gaz", "Foncia Gambetta", "2027-03-31"],
  ["Apt 7", "T1 bis", "m-2024-0058", 29, "22 cours Gambetta", "69007", "Lyon", "4e sur 6, ascenseur", "D, valable jusqu'en 2032", "Collectif, gaz", "Foncia Gambetta", "2027-03-31"],
  ["Apt 9", "T3", "m-2024-0058", 64, "22 cours Gambetta", "69007", "Lyon", "5e sur 6, ascenseur", "C, valable jusqu'en 2035", "Collectif, gaz", "Foncia Gambetta", "2027-03-31"],
  ["Maison Les Pins", "Maison", "m-2023-0071", 96, "9 chemin des Pins", "69130", "Écully", "Plain-pied avec étage", "B, valable jusqu'en 2036", "Individuel, pompe à chaleur", "Sans syndic", "2026-12-31"],
  ["Apt 5", "T2", "m-2023-0071", 44, "31 rue Duguesclin", "69003", "Lyon", "2e sur 4, sans ascenseur", "C, valable jusqu'en 2034", "Individuel, gaz", "Cabinet Duguesclin", "2026-12-31"],
  ["Lot 1", "T3", "m-2022-0019", 62, "17 avenue des Acacias", "69100", "Villeurbanne", "Rez-de-chaussée", "C, valable jusqu'en 2033", "Collectif, réseau urbain", "Cabinet Acacias", "2027-09-30"],
  ["Lot 2", "T4", "m-2022-0019", 78, "17 avenue des Acacias", "69100", "Villeurbanne", "1er sur 3", "C, valable jusqu'en 2033", "Collectif, réseau urbain", "Cabinet Acacias", "2027-09-30"],
  ["Lot 3", "Chambre", "m-2022-0019", 14, "17 avenue des Acacias", "69100", "Villeurbanne", "3e sur 3", "E, valable jusqu'en 2031", "Collectif, réseau urbain", "Cabinet Acacias", "2027-09-30"],
  ["Lot 4", "T3", "m-2022-0019", 60, "17 avenue des Acacias", "69100", "Villeurbanne", "2e sur 3", "C, valable jusqu'en 2033", "Collectif, réseau urbain", "Cabinet Acacias", "2027-09-30"],
  ["Apt 2", "T3", "m-2024-0033", 58, "3 rue Sainte-Hélène", "69002", "Lyon", "1er sur 4, ascenseur", "D, valable jusqu'en 2034", "Collectif, gaz", "Cabinet Lefèvre", "2027-01-31"],
  ["Apt 6", "T2", "m-2024-0033", 41, "3 rue Sainte-Hélène", "69002", "Lyon", "3e sur 4, ascenseur", "D, valable jusqu'en 2034", "Collectif, gaz", "Cabinet Lefèvre", "2027-01-31"],
  ["Maison de ville", "T4", "m-2025-0201", 78, "12 rue Pierre Corneille", "69003", "Lyon", "Maison sur deux niveaux", "C, valable jusqu'en 2035", "Individuel, gaz", "Sans syndic", "2026-12-31"],
];

export const demoBiens: Bien[] = bienSeeds.map(
  ([name, kind, mandatId, surfaceM2, street, postalCode, city, floor, dpe, heating, syndic, pnoUntilIso]) => ({
    id: slugify(name),
    name,
    kind,
    surfaceM2,
    street,
    postalCode,
    city,
    mandatId,
    floor,
    dpe,
    heating,
    syndic,
    pnoUntilIso,
    propertyTax: "Payée par le mandant",
  }),
);

export const demoCompliance: ComplianceItem[] = [
  { id: "carte-pro", label: "Carte professionnelle", detail: "Valable jusqu'au 30/06/2028", state: "valide" },
  { id: "garantie", label: "Garantie financière", detail: "Valable jusqu'au 31/12/2027", state: "valide" },
  { id: "rcp", label: "Assurance RCP", detail: "Échéance le 31/12/2026", state: "a_renouveler" },
  { id: "comptes", label: "Comptes mandants", detail: "Fonds des mandants séparés", state: "conforme" },
];
