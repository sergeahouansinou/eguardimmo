import { createCollection, DEMO_TODAY } from '../../outils/kit';
import { BIENS, tenantOf } from '../shared/biens';
import type { BienId } from '../shared/biens';
import { uniqueSlug } from '../shared/ids';
import { documentInputSchema, documentPatchSchema } from './schemas';
import type { DocumentRecord } from './schemas';
import type { DocumentsSource } from './source';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre'] as const;
const LOTS: readonly BienId[] = ['apt-a1', 'villa-rdc', 'apt-b3'];
const two = (value: number) => String(value).padStart(2, '0');

const slug = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const named: DocumentRecord[] = [
  { id: 'bail-signe-apt-a1-pdf', fileName: 'Bail signé, Apt A1.pdf', bienId: 'apt-a1', description: "Bail d'habitation vide", sharedWith: 'Koffi Adjovi', shared: true, sizeBytes: 1_200_000, date: '2026-04-01', archived: false },
  { id: 'etat-des-lieux-d-entree-pdf', fileName: "État des lieux d'entrée.pdf", bienId: 'apt-a1', description: 'Entrée du 01/04/2026', sharedWith: 'Koffi Adjovi', shared: true, sizeBytes: 4_800_000, date: '2026-04-01', archived: false },
  { id: 'diagnostic-electrique-pdf', fileName: 'Diagnostic électrique.pdf', bienId: 'villa-rdc', description: "Valable jusqu'en 2031", sharedWith: 'Marc Dossou', shared: false, sizeBytes: 860_000, date: '2025-05-12', archived: false },
  { id: 'attestation-d-assurance-pdf', fileName: "Attestation d'assurance.pdf", bienId: 'residence-du-parc', description: "Assurance de l'immeuble", sharedWith: null, shared: false, sizeBytes: 212_000, date: '2026-10-03', archived: false },
];

function generated(index: number): DocumentRecord {
  const round = Math.floor(index / 6);
  const kind = index % 6;
  const month = MONTHS[round] ?? 'octobre';
  const lot = LOTS[round % LOTS.length] ?? 'apt-a1';
  const lotName = BIENS.find((bien) => bien.id === lot)?.short ?? lot;
  const date = `2026-${two(round + 1)}-${two(1 + kind * 4)}`;
  const sizeBytes = 300_000 + index * 37_000;
  const base = { sizeBytes, date, archived: false };
  const variants: Pick<DocumentRecord, 'fileName' | 'bienId' | 'description' | 'sharedWith' | 'shared'>[] = [
    { fileName: `Quittance de loyer, ${month} 2026, ${lotName}.pdf`, bienId: lot, description: `Loyer de ${month}`, sharedWith: tenantOf(lot), shared: true },
    { fileName: `Avis d'échéance, ${month} 2026, ${lotName}.pdf`, bienId: lot, description: `Échéance de ${month}`, sharedWith: tenantOf(lot), shared: true },
    { fileName: `Facture entretien, ${month} 2026.pdf`, bienId: lot, description: 'Facture fournisseur', sharedWith: null, shared: false },
    { fileName: `Relevé de charges, ${month} 2026.pdf`, bienId: 'les-tilleuls', description: 'Relevé du syndic', sharedWith: null, shared: false },
    { fileName: `Compte rendu de visite, ${month} 2026.pdf`, bienId: 'residence-du-parc', description: 'Visite annuelle', sharedWith: null, shared: false },
    { fileName: `Photos du logement, ${month} 2026, ${lotName}.pdf`, bienId: lot, description: 'Suivi de l’état du logement', sharedWith: tenantOf(lot), shared: false },
  ];
  const variant = variants[kind];
  if (!variant) throw new RangeError('Variante de document inconnue');
  return { ...variant, ...base, id: slug(variant.fileName) };
}

const archives: DocumentRecord[] = Array.from({ length: 12 }, (_, index) => ({
  id: `archive-${two(index + 1)}`,
  fileName: `Ancien dossier ${String(index + 1)}, ${index < 6 ? '2024' : '2025'}.pdf`,
  bienId: LOTS[index % LOTS.length] ?? null,
  description: 'Dossier clos',
  sharedWith: null,
  shared: false,
  sizeBytes: 300_000 + index * 41_000,
  date: `${index < 6 ? '2024' : '2025'}-${two((index % 6) * 2 + 1)}-15`,
  archived: true,
}));

export const demoDocuments: readonly DocumentRecord[] = [
  ...named,
  ...Array.from({ length: 60 }, (_, index) => generated(index)),
  ...archives,
];

export function createDemoDocumentsSource(): DocumentsSource {
  const items = createCollection(demoDocuments);
  const updateMany = async (ids: readonly string[], patch: Partial<Omit<DocumentRecord, 'id'>>) => {
    const current = await items.list();
    const unknown = ids.filter((id) => !current.some((item) => item.id === id));
    if (unknown.length > 0) throw new Error(`Documents introuvables : ${unknown.join(', ')}`);
    await Promise.all(ids.map((id) => items.update(id, patch)));
  };
  return {
    list: () => items.list(),
    createMany: async (drafts) => {
      const inputs = drafts.map((draft) => documentInputSchema.parse(draft));
      const ids = (await items.list()).map((item) => item.id);
      for (const input of inputs) {
        const id = uniqueSlug(input.fileName, ids, 'document');
        ids.push(id);
        await items.add({ ...input, id, date: DEMO_TODAY, archived: false });
      }
    },
    update: async (id, patch) => items.update(id, documentPatchSchema.parse(patch)),
    setShared: (ids, shared) => updateMany(ids, { shared }),
    setArchived: (ids, archived) => updateMany(ids, { archived }),
    remove: async (ids) => {
      await Promise.all(ids.map((id) => items.remove(id)));
    },
  };
}
