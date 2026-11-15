import type { DocumentRecord } from '../schemas/common';

let counter = 0;

function doc(
  kind: DocumentRecord['owner']['kind'],
  owner: string,
  name: string,
  category: string,
  date: string,
  shared: boolean,
  sizeBytes: number,
): DocumentRecord {
  counter += 1;
  return { id: `doc-${String(counter).padStart(3, '0')}`, owner: { kind, id: owner }, name, category, date, shared, sizeBytes };
}

const KO = 1024;
const MO = 1024 * 1024;

export function seedDocuments(): DocumentRecord[] {
  counter = 0;
  return [
    doc('lot', 'apt-a1', 'Bail signé, Koffi Adjovi', 'Bail', '2023-04-01', true, 1.2 * MO),
    doc('lot', 'apt-a1', 'État des lieux d’entrée', 'Bail', '2023-04-01', true, 8.4 * MO),
    doc('lot', 'apt-a1', 'Notice d’information', 'Bail', '2023-04-01', true, 310 * KO),
    doc('lot', 'apt-a1', 'DPE, performance énergétique', 'Diagnostic', '2024-03-12', true, 2.1 * MO),
    doc('lot', 'apt-a1', 'État des risques', 'Diagnostic', '2023-04-02', true, 640 * KO),
    doc('lot', 'apt-a1', 'Diagnostic électricité', 'Diagnostic', '2020-02-10', true, 1.4 * MO),
    doc('lot', 'apt-a1', 'Repérage amiante', 'Diagnostic', '2016-05-28', false, 980 * KO),
    doc('lot', 'apt-a1', 'Attestation d’assurance du locataire', 'Assurance', '2026-03-28', false, 220 * KO),
    doc('lot', 'apt-a1', 'Extrait du règlement de copropriété', 'Copropriété', '2023-04-01', true, 1.8 * MO),
    doc('lot', 'lot-b3', 'Bail meublé, Yann Le Gall', 'Bail', '2024-11-01', true, 1.1 * MO),
    doc('lot', 'lot-b3', 'Inventaire du mobilier', 'Bail', '2024-11-01', true, 520 * KO),
    doc('lot', 'apt-a2', 'Bail signé, Nadège Sossou', 'Bail', '2024-07-01', true, 1.2 * MO),
    doc('immeuble', 'les-tilleuls', 'Règlement de copropriété', 'Copropriété', '2019-09-18', false, 4.8 * MO),
    doc('immeuble', 'les-tilleuls', 'État descriptif de division', 'Copropriété', '2019-09-18', false, 1.1 * MO),
    doc('immeuble', 'les-tilleuls', 'Fiche synthétique de la copropriété', 'Copropriété', '2026-04-02', false, 220 * KO),
    doc('immeuble', 'les-tilleuls', 'DPE collectif', 'Diagnostic', '2026-02-12', false, 2.6 * MO),
    doc('immeuble', 'les-tilleuls', 'Plan pluriannuel de travaux', 'Travaux', '2025-03-22', false, 3.4 * MO),
    doc('immeuble', 'les-tilleuls', 'Procès-verbal d’AG 2026', 'Assemblée', '2026-03-14', false, 960 * KO),
    doc('immeuble', 'les-tilleuls', 'Appel de fonds, 4e trimestre', 'Appel de fonds', '2026-10-01', false, 180 * KO),
    doc('immeuble', 'residence-du-parc', 'Assurance de l’immeuble', 'Assurance', '2026-01-10', false, 410 * KO),
    doc('equipement', 'climatiseur-reversible', 'Facture d’achat et pose', 'Facture', '2025-06-20', false, 420 * KO),
    doc('equipement', 'climatiseur-reversible', 'Notice d’utilisation', 'Notice', '2025-06-20', true, 3.2 * MO),
    doc('equipement', 'climatiseur-reversible', 'Attestation de capacité de l’installateur', 'Attestation', '2025-06-20', false, 180 * KO),
    doc('equipement', 'climatiseur-reversible', 'Certificat de garantie', 'Garantie', '2025-06-20', false, 240 * KO),
  ].map((record) => ({ ...record, sizeBytes: Math.round(record.sizeBytes) }));
}

export const documentCategories: Record<DocumentRecord['owner']['kind'], string[]> = {
  lot: ['Bail', 'Diagnostic', 'Assurance', 'Copropriété', 'Facture', 'Autre'],
  immeuble: ['Copropriété', 'Assemblée', 'Travaux', 'Diagnostic', 'Appel de fonds', 'Assurance', 'Autre'],
  equipement: ['Facture', 'Notice', 'Attestation', 'Garantie', 'Autre'],
};
