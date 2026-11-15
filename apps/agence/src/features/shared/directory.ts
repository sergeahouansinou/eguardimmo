export interface Mandant {
  id: string;
  name: string;
  kind: string;
  mandateRef: string;
  mandateRenewal: boolean;
  ibanLast4: string;
  email: string;
}

export interface Tenant {
  id: string;
  name: string;
  email: string;
}

export interface Lot {
  id: string;
  label: string;
  description: string;
  address: string;
  mandantId: string;
  tenantId: string;
  rentMinor: number;
  chargesMinor: number;
}

export const AGENCY = {
  name: "Cabinet Delmas Immobilier",
  tagline: "Agence de gestion locative, Paris",
  email: "contact@delmas-immobilier.example",
  mandantsAccountLast4: "1208",
} as const;

export const CURRENT_USER = {
  id: "sophie-delmas",
  firstName: "Sophie",
  lastName: "Delmas",
  name: "Sophie Delmas",
  initials: "SD",
  email: "sophie.delmas@example.com",
  role: "Titulaire",
} as const;

export const MANDANTS: readonly Mandant[] = [
  { id: "marc-chevalier", name: "Marc Chevalier", kind: "SCI Chevalier", mandateRef: "M-2025-0142", mandateRenewal: false, ibanLast4: "2031", email: "marc.chevalier@example.com" },
  { id: "famille-bernard", name: "Famille Bernard", kind: "Indivision", mandateRef: "M-2024-0058", mandateRenewal: false, ibanLast4: "7745", email: "famille.bernard@example.com" },
  { id: "helene-roussel", name: "Hélène Roussel", kind: "Particulier", mandateRef: "M-2023-0071", mandateRenewal: true, ibanLast4: "5518", email: "helene.roussel@example.com" },
  { id: "sci-les-acacias", name: "SCI Les Acacias", kind: "Société civile", mandateRef: "M-2022-0019", mandateRenewal: false, ibanLast4: "9086", email: "contact@sci-acacias.example" },
  { id: "paul-lemoine", name: "Paul Lemoine", kind: "Particulier", mandateRef: "M-2024-0033", mandateRenewal: true, ibanLast4: "3372", email: "paul.lemoine@example.com" },
  { id: "nadia-benali", name: "Nadia Benali", kind: "Particulier", mandateRef: "M-2025-0201", mandateRenewal: false, ibanLast4: "6620", email: "nadia.benali@example.com" },
];

export const TENANTS: readonly Tenant[] = [
  { id: "thomas-girard", name: "Thomas Girard", email: "thomas.girard@example.com" },
  { id: "anais-roux", name: "Anaïs Roux", email: "anais.roux@example.com" },
  { id: "karim-haddad", name: "Karim Haddad", email: "karim.haddad@example.com" },
  { id: "julie-marchand", name: "Julie Marchand", email: "julie.marchand@example.com" },
  { id: "louis-petit", name: "Louis Petit", email: "louis.petit@example.com" },
  { id: "camille-dupuis", name: "Camille Dupuis", email: "camille.dupuis@example.com" },
  { id: "yann-morel", name: "Yann Morel", email: "yann.morel@example.com" },
  { id: "sarah-mensah", name: "Sarah Mensah", email: "sarah.mensah@example.com" },
  { id: "olivier-blanc", name: "Olivier Blanc", email: "olivier.blanc@example.com" },
  { id: "ines-laurent", name: "Inès Laurent", email: "ines.laurent@example.com" },
  { id: "eric-fabre", name: "Éric Fabre", email: "eric.fabre@example.com" },
  { id: "hugo-perrin", name: "Hugo Perrin", email: "hugo.perrin@example.com" },
  { id: "lea-vidal", name: "Léa Vidal", email: "lea.vidal@example.com" },
  { id: "mathieu-garnier", name: "Mathieu Garnier", email: "mathieu.garnier@example.com" },
];

export const LOTS: readonly Lot[] = [
  { id: "apt-12", label: "Apt 12", description: "T2, 38 m²", address: "12 rue de la Paix", mandantId: "marc-chevalier", tenantId: "thomas-girard", rentMinor: 62000, chargesMinor: 8000 },
  { id: "studio-4", label: "Studio 4", description: "Studio, 21 m²", address: "5 rue Vendôme", mandantId: "marc-chevalier", tenantId: "anais-roux", rentMinor: 40000, chargesMinor: 5000 },
  { id: "apt-9", label: "Apt 9", description: "T3, 61 m²", address: "9 avenue Foch", mandantId: "famille-bernard", tenantId: "karim-haddad", rentMinor: 120000, chargesMinor: 17000 },
  { id: "apt-3", label: "Apt 3", description: "T4, 82 m²", address: "3 avenue Foch", mandantId: "famille-bernard", tenantId: "julie-marchand", rentMinor: 128000, chargesMinor: 20000 },
  { id: "apt-7", label: "Apt 7", description: "T2, 44 m²", address: "7 avenue Foch", mandantId: "famille-bernard", tenantId: "louis-petit", rentMinor: 45000, chargesMinor: 6000 },
  { id: "lot-1", label: "Lot 1", description: "T3, 58 m²", address: "Résidence Les Acacias", mandantId: "sci-les-acacias", tenantId: "camille-dupuis", rentMinor: 110000, chargesMinor: 15000 },
  { id: "lot-2", label: "Lot 2", description: "T4, 79 m²", address: "Résidence Les Acacias", mandantId: "sci-les-acacias", tenantId: "yann-morel", rentMinor: 130000, chargesMinor: 18000 },
  { id: "lot-3", label: "Lot 3", description: "Studio, 25 m²", address: "Résidence Les Acacias", mandantId: "sci-les-acacias", tenantId: "sarah-mensah", rentMinor: 26000, chargesMinor: 4000 },
  { id: "lot-4", label: "Lot 4", description: "T4, 85 m²", address: "Résidence Les Acacias", mandantId: "sci-les-acacias", tenantId: "olivier-blanc", rentMinor: 106000, chargesMinor: 16000 },
  { id: "apt-5", label: "Apt 5", description: "T3, 55 m²", address: "5 rue des Lilas", mandantId: "helene-roussel", tenantId: "ines-laurent", rentMinor: 64000, chargesMinor: 10000 },
  { id: "maison-les-pins", label: "Maison Les Pins", description: "Maison, 96 m²", address: "14 chemin des Pins", mandantId: "helene-roussel", tenantId: "eric-fabre", rentMinor: 96000, chargesMinor: 14000 },
  { id: "apt-2", label: "Apt 2", description: "T3, 57 m²", address: "2 rue des Tilleuls", mandantId: "paul-lemoine", tenantId: "hugo-perrin", rentMinor: 66000, chargesMinor: 10000 },
  { id: "apt-6", label: "Apt 6", description: "T2, 41 m²", address: "6 rue des Tilleuls", mandantId: "paul-lemoine", tenantId: "lea-vidal", rentMinor: 57000, chargesMinor: 9000 },
  { id: "maison-de-ville", label: "Maison de ville", description: "Maison, 88 m²", address: "21 rue du Marché", mandantId: "nadia-benali", tenantId: "mathieu-garnier", rentMinor: 103000, chargesMinor: 15000 },
];

export function mandantById(id: string): Mandant | undefined {
  return MANDANTS.find((mandant) => mandant.id === id);
}

export function lotById(id: string): Lot | undefined {
  return LOTS.find((lot) => lot.id === id);
}

export function tenantById(id: string): Tenant | undefined {
  return TENANTS.find((tenant) => tenant.id === id);
}

export function lotsOfMandant(mandantId: string): readonly Lot[] {
  return LOTS.filter((lot) => lot.mandantId === mandantId);
}
