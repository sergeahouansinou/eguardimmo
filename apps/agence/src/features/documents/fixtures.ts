import { LOTS, MANDANTS, TENANTS } from "@/features/shared/directory";
import { addDays } from "@/features/shared/dates";
import { MB } from "@/features/shared/files";
import { AGENCY_OWNER } from "./schemas";
import type { Category, DocumentRecord } from "./schemas";

const KB = 1024;

interface Seed {
  fileName: string;
  ownerId: string;
  lotId?: string;
  tenantId?: string;
  category: Category;
  mandant?: boolean;
  tenant?: boolean;
  sizeBytes: number;
  date: string;
  validUntil?: string;
  archived?: boolean;
}

function record(index: number, seed: Seed): DocumentRecord {
  return {
    id: `doc-${String(index + 1)}`,
    fileName: seed.fileName,
    displayName: seed.fileName,
    ownerId: seed.ownerId,
    lotId: seed.lotId ?? null,
    tenantId: seed.tenantId ?? null,
    category: seed.category,
    sharedWithMandant: seed.mandant ?? false,
    sharedWithTenant: seed.tenant ?? false,
    sizeBytes: seed.sizeBytes,
    date: seed.date,
    validUntil: seed.validUntil ?? null,
    description: "",
    archived: seed.archived ?? false,
  };
}

const FEATURED: readonly Seed[] = [
  { fileName: "Mandat M-2025-0142 signé.pdf", ownerId: "marc-chevalier", category: "Mandat", mandant: true, sizeBytes: Math.round(1.2 * MB), date: "2025-03-14" },
  { fileName: "Attestation RCP 2026.pdf", ownerId: AGENCY_OWNER, category: "Conformité", sizeBytes: 212 * KB, date: "2026-01-02", validUntil: "2026-12-31" },
  { fileName: "Garantie financière 2026.pdf", ownerId: AGENCY_OWNER, category: "Conformité", sizeBytes: 188 * KB, date: "2026-01-05", validUntil: "2027-12-31" },
  { fileName: "Compte rendu, octobre 2026.pdf", ownerId: "marc-chevalier", category: "Compte rendu", mandant: true, sizeBytes: 340 * KB, date: "2026-11-02" },
  { fileName: "Devis plomberie Studio 4.pdf", ownerId: "marc-chevalier", lotId: "studio-4", category: "Devis", sizeBytes: 96 * KB, date: "2026-11-13", validUntil: "2026-12-13" },
  { fileName: "Photo fuite évier.jpg", ownerId: "marc-chevalier", lotId: "studio-4", category: "Photo", sizeBytes: Math.round(1.4 * MB), date: "2026-11-12" },
  { fileName: "Bail Anaïs Roux.pdf", ownerId: "marc-chevalier", lotId: "studio-4", tenantId: "anais-roux", category: "Bail", tenant: true, sizeBytes: Math.round(1.1 * MB), date: "2025-09-03" },
];

const AGENCY_DOCUMENTS: readonly [string, Category][] = [
  ["Extrait Kbis Cabinet Delmas.pdf", "Conformité"],
  ["Attestation de vigilance URSSAF 2026.pdf", "Conformité"],
  ["Carte professionnelle CPI 7501.pdf", "Conformité"],
  ["Registre des mandats 2026.pdf", "Conformité"],
  ["Attestations de formation 2024-2026.pdf", "Conformité"],
  ["Conditions générales de gestion.pdf", "Autre"],
];

function generated(): Seed[] {
  const seeds: Seed[] = [];
  const dateOf = (n: number) => addDays("2025-01-15", (n * 13) % 590);
  const sizeOf = (n: number) => (90 + ((n * 37) % 700)) * KB;
  let counter = 0;
  const next = () => {
    counter += 1;
    return counter;
  };

  AGENCY_DOCUMENTS.forEach(([fileName, category]) => {
    const n = next();
    seeds.push({ fileName, ownerId: AGENCY_OWNER, category, sizeBytes: sizeOf(n), date: dateOf(n) });
  });

  MANDANTS.slice(1).forEach((mandant) => {
    const n = next();
    seeds.push({
      fileName: `Mandat ${mandant.mandateRef} signé.pdf`,
      ownerId: mandant.id,
      category: "Mandat",
      mandant: true,
      sizeBytes: sizeOf(n),
      date: dateOf(n),
    });
    const m = next();
    seeds.push({
      fileName: `Compte rendu, octobre 2026 ${mandant.name}.pdf`,
      ownerId: mandant.id,
      category: "Compte rendu",
      mandant: true,
      sizeBytes: sizeOf(m),
      date: addDays("2026-11-02", m % 3),
    });
  });

  LOTS.forEach((lot) => {
    const tenant = TENANTS.find((candidate) => candidate.id === lot.tenantId);
    const base = { ownerId: lot.mandantId, lotId: lot.id };
    const q = next();
    seeds.push({
      ...base,
      tenantId: lot.tenantId,
      fileName: `Quittance octobre 2026 ${lot.label}.pdf`,
      category: "Quittance",
      tenant: true,
      mandant: true,
      sizeBytes: 60 * KB + (q % 40) * KB,
      date: addDays("2026-10-05", q % 4),
    });
    const d = next();
    seeds.push({
      ...base,
      fileName: `Diagnostic de performance énergétique ${lot.label}.pdf`,
      category: "Diagnostic",
      mandant: true,
      sizeBytes: sizeOf(d),
      date: dateOf(d),
      validUntil: addDays("2027-03-01", d * 11),
    });
    if (lot.id !== "studio-4" && tenant) {
      const b = next();
      seeds.push({
        ...base,
        tenantId: lot.tenantId,
        fileName: `Bail ${tenant.name}.pdf`,
        category: "Bail",
        tenant: true,
        sizeBytes: sizeOf(b),
        date: dateOf(b),
      });
    }
  });

  LOTS.slice(0, 12).forEach((lot) => {
    const q = next();
    seeds.push({
      ownerId: lot.mandantId,
      lotId: lot.id,
      tenantId: lot.tenantId,
      fileName: `Quittance septembre 2026 ${lot.label}.pdf`,
      category: "Quittance",
      tenant: true,
      mandant: true,
      archived: true,
      sizeBytes: 60 * KB + (q % 40) * KB,
      date: addDays("2026-09-05", q % 4),
    });
  });

  return seeds;
}

export function initialDocuments(): DocumentRecord[] {
  return [...FEATURED, ...generated()].map((seed, index) => record(index, seed));
}
