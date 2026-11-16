import { BiensError } from '../errors';
import type { DiagnosticInput } from '../source';
import { addDays, addMonths } from '../lib/dates';
import { fold, uniqueId } from '../lib/text';
import { lotImportRowSchema, lotValuesSchema } from '../schemas/lots';
import type { Diagnostic, Listing, LotImportRow, LotValues } from '../schemas/lots';
import { AS_OF } from './records';
import type { LotRecord } from './records';
import { lotExtrasOf } from './read-lots';
import type { DemoState } from './state';
import { emptyLotExtras } from './state';

function findLot(state: DemoState, id: string): LotRecord {
  const record = state.lots.find((item) => item.row.id === id);
  if (!record) throw new BiensError('Bien introuvable.');
  return record;
}

function assertUniqueName(state: DemoState, immeubleId: string, name: string, selfId: string | null): void {
  const clash = state.lots.some(
    (lot) => lot.row.id !== selfId && lot.row.immeubleId === immeubleId && fold(lot.row.name) === fold(name),
  );
  if (clash) throw new BiensError(`Un bien nommé « ${name} » existe déjà dans cet immeuble.`);
}

function apply(record: LotRecord, values: LotValues): void {
  const rentExcl = values.rent ?? 0;
  const charges = values.charges ?? 0;
  record.row.name = values.name;
  record.row.type = values.type;
  record.row.immeubleId = values.immeubleId;
  record.row.surface = values.surface ?? record.row.surface;
  record.row.rooms = values.rooms ?? 0;
  record.row.floor = values.floor === '' ? null : values.floor;
  record.row.rent = rentExcl + charges;
  record.street = values.address;
  record.complement = values.complement;
  record.postalCode = values.postalCode;
  record.city = values.city;
  record.elevator = values.elevator;
  record.heating = values.heating;
  record.amenities = values.amenities;
  record.rentExcl = rentExcl;
  record.charges = charges;
  record.photoNames = values.photoNames;
}

function parseValues(state: DemoState, values: LotValues): LotValues {
  const parsed = lotValuesSchema.safeParse(values);
  if (!parsed.success) throw new BiensError('Les informations du bien sont invalides.');
  if (!state.immeubles.some((item) => item.row.id === parsed.data.immeubleId)) throw new BiensError('Immeuble introuvable.');
  return parsed.data;
}

function newRecord(id: string): LotRecord {
  return {
    row: {
      id,
      name: '',
      immeubleId: '',
      type: 'appartement',
      surface: 1,
      rooms: 0,
      floor: null,
      tenant: null,
      rent: 0,
      listing: 'hors_ligne',
      status: 'a_louer',
      tantiemes: null,
      elevatorShares: null,
      leaseEnd: null,
      leaseNote: null,
      archived: false,
    },
    street: '',
    complement: '',
    postalCode: '',
    city: '',
    elevator: false,
    heating: 'electrique',
    amenities: [],
    rentExcl: 0,
    charges: 0,
    photoNames: [],
    rich: null,
  };
}

export function createLot(state: DemoState, input: LotValues): { id: string } {
  const values = parseValues(state, input);
  assertUniqueName(state, values.immeubleId, values.name, null);
  const id = uniqueId(values.name, new Set(state.lots.map((lot) => lot.row.id)));
  const record = newRecord(id);
  apply(record, values);
  state.lots.push(record);
  return { id };
}

export function updateLot(state: DemoState, id: string, input: LotValues): void {
  const record = findLot(state, id);
  const values = parseValues(state, input);
  assertUniqueName(state, values.immeubleId, values.name, id);
  apply(record, values);
}

export function setLotsArchived(state: DemoState, ids: string[], archived: boolean): void {
  if (ids.length === 0) throw new BiensError('Aucun bien sélectionné.');
  const records = ids.map((id) => findLot(state, id));
  if (archived) {
    const rented = records.find((record) => record.row.tenant !== null);
    if (rented) throw new BiensError(`Le bien « ${rented.row.name} » est loué : mettez fin au bail avant de l’archiver.`);
  }
  records.forEach((record) => {
    record.row.archived = archived;
    if (archived) record.row.listing = 'hors_ligne';
  });
}

function blocker(state: DemoState, record: LotRecord): string | null {
  const { id } = record.row;
  if (record.row.tenant) return 'le bien est loué';
  if (state.equipements.some((item) => item.row.lotId === id)) return 'des équipements y sont rattachés';
  if (state.meters.some((meter) => meter.lotId === id && state.readings.some((reading) => reading.meterId === meter.id))) {
    return 'des relevés de compteurs y sont rattachés';
  }
  if (state.inventaires.some((item) => item.lotId === id)) return 'des inventaires y sont rattachés';
  return null;
}

export function deleteLot(state: DemoState, id: string): void {
  const record = findLot(state, id);
  const reason = blocker(state, record);
  if (reason) throw new BiensError(`Suppression impossible : ${reason}. Archivez le bien à la place.`);
  state.lots = state.lots.filter((item) => item.row.id !== id);
  state.documents = state.documents.filter((item) => !(item.owner.kind === 'lot' && item.owner.id === id));
  state.meters = state.meters.filter((meter) => meter.lotId !== id);
  Reflect.deleteProperty(state.lotExtras, id);
}

export function duplicateLot(state: DemoState, id: string): { id: string } {
  const source = findLot(state, id);
  let name = `${source.row.name} (copie)`;
  let index = 2;
  while (state.lots.some((lot) => lot.row.immeubleId === source.row.immeubleId && fold(lot.row.name) === fold(name))) {
    name = `${source.row.name} (copie ${String(index)})`;
    index += 1;
  }
  const copy: LotRecord = {
    ...structuredClone(source),
    row: {
      ...structuredClone(source.row),
      id: uniqueId(name, new Set(state.lots.map((lot) => lot.row.id))),
      name,
      tenant: null,
      listing: 'hors_ligne',
      status: 'a_louer',
      leaseEnd: null,
      leaseNote: null,
      archived: false,
    },
    photoNames: [],
    rich: null,
  };
  state.lots.push(copy);
  return { id: copy.row.id };
}

export function setLotListing(state: DemoState, id: string, listing: Listing): void {
  const record = findLot(state, id);
  if (record.row.archived) throw new BiensError('Un bien archivé ne peut pas être publié.');
  record.row.listing = listing;
}

export function importLots(state: DemoState, rows: LotImportRow[]): { created: number } {
  if (rows.length === 0) throw new BiensError('Le fichier ne contient aucune ligne à importer.');
  const planned = rows.map((input, index) => {
    const line = index + 1;
    const parsed = lotImportRowSchema.safeParse(input);
    if (!parsed.success) throw new BiensError(`Ligne ${String(line)} : valeurs invalides.`);
    const immeuble = state.immeubles.find((item) => fold(item.row.name) === fold(parsed.data.immeubleName));
    if (!immeuble) throw new BiensError(`Ligne ${String(line)} : immeuble inconnu « ${parsed.data.immeubleName} ».`);
    return { row: parsed.data, immeuble };
  });
  const seen = new Set<string>();
  planned.forEach(({ row, immeuble }, index) => {
    const key = `${immeuble.row.id}:${fold(row.name)}`;
    const exists = state.lots.some((lot) => lot.row.immeubleId === immeuble.row.id && fold(lot.row.name) === fold(row.name));
    if (exists || seen.has(key)) throw new BiensError(`Ligne ${String(index + 1)} : le bien « ${row.name} » existe déjà.`);
    seen.add(key);
  });
  planned.forEach(({ row, immeuble }) => {
    const record = newRecord(uniqueId(row.name, new Set(state.lots.map((lot) => lot.row.id))));
    record.row.name = row.name;
    record.row.immeubleId = immeuble.row.id;
    record.row.type = row.type;
    record.row.surface = row.surface;
    record.row.rooms = row.rooms ?? 0;
    record.row.rent = row.rent ?? 0;
    record.rentExcl = row.rent ?? 0;
    record.street = immeuble.row.address;
    record.postalCode = immeuble.row.postalCode;
    record.city = immeuble.row.city;
    state.lots.push(record);
  });
  return { created: planned.length };
}

function expiryOf(doneOn: string, validity: string): string | null {
  const match = /^(\d+)\s*(an|ans|mois)$/i.exec(validity.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  const months = (match[2] ?? '').toLowerCase() === 'mois' ? amount : amount * 12;
  return addDays(addMonths(doneOn, months), -1);
}

export function addDiagnostic(state: DemoState, lotId: string, input: DiagnosticInput): void {
  findLot(state, lotId);
  const label = input.label.trim();
  if (label === '') throw new BiensError('Le libellé du diagnostic est requis.');
  if (input.doneOn > AS_OF) throw new BiensError('La date du diagnostic ne peut pas être dans le futur.');
  const extras = lotExtrasOf(state, lotId);
  extras.diagnostics ??= { asOf: AS_OF, items: [], dpe: null };
  const expiresOn = expiryOf(input.doneOn, input.validity);
  const existing = extras.diagnostics.items.find((item) => fold(item.label) === fold(label));
  const item: Diagnostic = {
    id: existing?.id ?? uniqueId(label, new Set(extras.diagnostics.items.map((entry) => entry.id))),
    label,
    doneOn: input.doneOn,
    validity: input.validity.trim() === '' ? 'Illimitée' : input.validity.trim(),
    expiresOn,
    expiresNote: null,
    result: input.result.trim(),
    ratings: null,
    status: expiresOn !== null && expiresOn < AS_OF ? 'expire' : 'valide',
    hasFile: false,
    orderedOn: null,
  };
  if (existing) extras.diagnostics.items = extras.diagnostics.items.map((entry) => (entry.id === existing.id ? item : entry));
  else extras.diagnostics.items = [...extras.diagnostics.items, item];
}

export function orderDiagnostics(state: DemoState, lotId: string, ids: string[]): void {
  findLot(state, lotId);
  if (ids.length === 0) throw new BiensError('Aucun diagnostic sélectionné.');
  const extras = state.lotExtras[lotId] ?? emptyLotExtras();
  const items = extras.diagnostics?.items ?? [];
  const targets = ids.map((id) => {
    const item = items.find((entry) => entry.id === id);
    if (!item) throw new BiensError('Diagnostic introuvable.');
    if (item.status !== 'a_refaire' && item.status !== 'expire') {
      throw new BiensError(`Le diagnostic « ${item.label} » n’a pas besoin d’être refait.`);
    }
    return item;
  });
  targets.forEach((item) => {
    item.orderedOn = AS_OF;
  });
}
