import { BiensError } from '../errors';
import type { DocumentInput } from '../source';
import { MAX_UPLOAD_BYTES } from '../schemas/common';
import type { Owner } from '../schemas/common';
import { readingInputSchema } from '../schemas/releves';
import type { InventaireInput, Reading, ReadingInput } from '../schemas/releves';
import { AS_OF } from './records';
import { documentCategories } from './seed-documents';
import { inventaireTemplates, kindUnit, unitPrice } from './seed-readings';
import type { DemoState } from './state';

function ownerExists(state: DemoState, owner: Owner): boolean {
  if (owner.kind === 'lot') return state.lots.some((item) => item.row.id === owner.id);
  if (owner.kind === 'immeuble') return state.immeubles.some((item) => item.row.id === owner.id);
  return state.equipements.some((item) => item.row.id === owner.id);
}

function nextNumber(ids: string[], prefix: string): number {
  return ids.reduce((max, id) => {
    const match = new RegExp(`^${prefix}(\\d+)$`).exec(id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
}

export function addDocument(state: DemoState, owner: Owner, input: DocumentInput): void {
  if (!ownerExists(state, owner)) throw new BiensError('Élément introuvable.');
  const name = input.name.trim();
  if (name === '') throw new BiensError('Le nom du document est requis.');
  if (input.sizeBytes <= 0) throw new BiensError('Le fichier est vide.');
  if (input.sizeBytes > MAX_UPLOAD_BYTES) throw new BiensError('Fichier trop volumineux (10 Mo au maximum).');
  if (!documentCategories[owner.kind].includes(input.category)) throw new BiensError('Catégorie inconnue.');
  const number = nextNumber(state.documents.map((item) => item.id), 'doc-');
  state.documents.push({
    id: `doc-${String(number).padStart(3, '0')}`,
    owner,
    name,
    category: input.category,
    date: AS_OF,
    shared: input.shared,
    sizeBytes: input.sizeBytes,
  });
}

export function setDocumentShared(state: DemoState, id: string, shared: boolean): void {
  const document = state.documents.find((item) => item.id === id);
  if (!document) throw new BiensError('Document introuvable.');
  document.shared = shared;
}

export function deleteDocument(state: DemoState, id: string): void {
  if (!state.documents.some((item) => item.id === id)) throw new BiensError('Document introuvable.');
  state.documents = state.documents.filter((item) => item.id !== id);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function chainOf(state: DemoState, meterId: string): Reading[] {
  return state.readings.filter((item) => item.meterId === meterId).sort((a, b) => a.date.localeCompare(b.date));
}

function relinkAfter(state: DemoState, meterId: string, date: string): void {
  const chain = chainOf(state, meterId);
  const position = chain.findIndex((item) => item.date > date);
  const next = chain[position];
  const kind = state.meters.find((meter) => meter.id === meterId)?.kind;
  if (position < 0 || !next || !kind) return;
  const previous = chain[position - 1];
  next.delta = previous ? round1(next.index - previous.index) : null;
  next.cost = next.delta === null ? null : Math.round(next.delta * unitPrice[kind]);
}

export function createReading(state: DemoState, input: ReadingInput): void {
  const parsed = readingInputSchema.safeParse(input);
  if (!parsed.success) throw new BiensError('Les informations du relevé sont invalides.');
  const values = parsed.data;
  const meter = state.meters.find((item) => item.id === values.meterId);
  if (!meter) throw new BiensError('Compteur introuvable.');
  if (values.date > AS_OF) throw new BiensError('La date du relevé ne peut pas être dans le futur.');
  const chain = chainOf(state, meter.id);
  if (chain.some((item) => item.date === values.date && item.reason === values.reason)) {
    throw new BiensError('Un relevé du même type existe déjà à cette date pour ce compteur.');
  }
  const previous = [...chain].reverse().find((item) => item.date <= values.date);
  const next = chain.find((item) => item.date > values.date);
  if (previous && values.index < previous.index) {
    throw new BiensError(`L’index doit être supérieur ou égal au relevé précédent (${String(previous.index)}).`);
  }
  if (next && values.index > next.index) {
    throw new BiensError(`L’index doit être inférieur ou égal au relevé suivant (${String(next.index)}).`);
  }
  const lot = state.lots.find((item) => item.row.id === meter.lotId);
  const delta = previous ? round1(values.index - previous.index) : null;
  const number = nextNumber(state.readings.map((item) => item.id), 'rel-');
  state.readings.push({
    id: `rel-${String(number).padStart(4, '0')}`,
    meterId: meter.id,
    lotId: meter.lotId,
    lotName: lot?.row.name ?? meter.lotId,
    kind: meter.kind,
    meterRef: meter.ref,
    unit: kindUnit[meter.kind],
    tenant: lot?.row.tenant?.name ?? null,
    reason: values.reason,
    date: values.date,
    index: values.index,
    delta,
    cost: delta === null ? null : Math.round(delta * unitPrice[meter.kind]),
    origin: values.origin,
    enteredBy: 'Vous',
    hasPhoto: values.hasPhoto,
    archived: false,
  });
  relinkAfter(state, meter.id, values.date);
}

export function updateReading(state: DemoState, id: string, input: ReadingInput): void {
  const existing = state.readings.find((item) => item.id === id);
  if (!existing) throw new BiensError('Relevé introuvable.');
  const before = state.readings;
  state.readings = before.filter((item) => item.id !== id);
  try {
    createReading(state, { ...input, hasPhoto: input.hasPhoto || existing.hasPhoto });
  } catch (error) {
    state.readings = before;
    throw error;
  }
  const created = state.readings.at(-1);
  if (created) {
    created.id = id;
    created.archived = existing.archived;
    created.enteredBy = existing.enteredBy;
  }
  relinkAfter(state, existing.meterId, existing.date);
}

export function attachReadingPhoto(state: DemoState, id: string): void {
  const reading = state.readings.find((item) => item.id === id);
  if (!reading) throw new BiensError('Relevé introuvable.');
  reading.hasPhoto = true;
}

export function setReadingArchived(state: DemoState, id: string, archived: boolean): void {
  const reading = state.readings.find((item) => item.id === id);
  if (!reading) throw new BiensError('Relevé introuvable.');
  reading.archived = archived;
}

export function deleteReading(state: DemoState, id: string): void {
  const reading = state.readings.find((item) => item.id === id);
  if (!reading) throw new BiensError('Relevé introuvable.');
  state.readings = state.readings.filter((item) => item.id !== id);
  relinkAfter(state, reading.meterId, reading.date);
}

function nextInventaireRef(state: DemoState): { id: string; ref: string } {
  const year = AS_OF.slice(0, 4);
  const number = nextNumber(
    state.inventaires.filter((item) => item.ref.startsWith(`INV-${year}-`)).map((item) => item.ref.replace(`INV-${year}-`, 'n')),
    'n',
  );
  const suffix = String(number).padStart(4, '0');
  return { id: `inv-${year}-${suffix}`, ref: `INV-${year}-${suffix}` };
}

function checkedInventaire(state: DemoState, input: InventaireInput) {
  const lot = state.lots.find((item) => item.row.id === input.lotId);
  if (!lot) throw new BiensError('Bien introuvable.');
  if (!inventaireTemplates.includes(input.template)) throw new BiensError('Modèle d’inventaire inconnu.');
  if (!Number.isInteger(input.value) || input.value < 0) throw new BiensError('La valeur doit être un montant positif.');
  const immeuble = state.immeubles.find((item) => item.row.id === lot.row.immeubleId);
  return {
    lotId: lot.row.id,
    lotName: lot.row.name,
    immeubleName: immeuble?.row.name ?? lot.row.immeubleId,
    tenant: input.tenant?.trim() ? input.tenant.trim() : (lot.row.tenant?.name ?? null),
    value: input.value,
    template: input.template,
  };
}

export function createInventaire(state: DemoState, input: InventaireInput): { id: string } {
  const checked = checkedInventaire(state, input);
  const identity = nextInventaireRef(state);
  state.inventaires.unshift({ ...identity, ...checked, createdOn: AS_OF, signatureSentOn: null, archived: false });
  return { id: identity.id };
}

export function updateInventaire(state: DemoState, id: string, input: InventaireInput): void {
  const item = state.inventaires.find((entry) => entry.id === id);
  if (!item) throw new BiensError('Inventaire introuvable.');
  Object.assign(item, checkedInventaire(state, input), { signatureSentOn: null });
}

export function requestInventaireSignature(state: DemoState, id: string): void {
  const item = state.inventaires.find((entry) => entry.id === id);
  if (!item) throw new BiensError('Inventaire introuvable.');
  if (item.tenant === null) throw new BiensError('Aucun locataire à qui envoyer l’inventaire : renseignez-le d’abord.');
  item.signatureSentOn = AS_OF;
}

export function duplicateInventaire(state: DemoState, id: string): { id: string } {
  const source = state.inventaires.find((item) => item.id === id);
  if (!source) throw new BiensError('Inventaire introuvable.');
  const identity = nextInventaireRef(state);
  state.inventaires.unshift({ ...source, ...identity, createdOn: AS_OF, signatureSentOn: null, archived: false });
  return { id: identity.id };
}

export function setInventaireArchived(state: DemoState, id: string, archived: boolean): void {
  const item = state.inventaires.find((entry) => entry.id === id);
  if (!item) throw new BiensError('Inventaire introuvable.');
  item.archived = archived;
}

export function deleteInventaire(state: DemoState, id: string): void {
  if (!state.inventaires.some((item) => item.id === id)) throw new BiensError('Inventaire introuvable.');
  state.inventaires = state.inventaires.filter((item) => item.id !== id);
}
