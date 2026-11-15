import { BiensError } from '../errors';
import { fold, uniqueId } from '../lib/text';
import { immeubleValuesSchema } from '../schemas/immeubles';
import type { ImmeubleValues } from '../schemas/immeubles';
import type { ImmeubleRecord } from './records';
import type { DemoState } from './state';

function findImmeuble(state: DemoState, id: string): ImmeubleRecord {
  const record = state.immeubles.find((item) => item.row.id === id);
  if (!record) throw new BiensError('Immeuble introuvable.');
  return record;
}

function parseValues(state: DemoState, input: ImmeubleValues, selfId: string | null): ImmeubleValues {
  const parsed = immeubleValuesSchema.safeParse(input);
  if (!parsed.success) throw new BiensError('Les informations de l’immeuble sont invalides.');
  const clash = state.immeubles.some((item) => item.row.id !== selfId && fold(item.row.name) === fold(parsed.data.name));
  if (clash) throw new BiensError(`Un immeuble nommé « ${parsed.data.name} » existe déjà.`);
  return parsed.data;
}

function apply(record: ImmeubleRecord, values: ImmeubleValues): void {
  record.row.name = values.name;
  record.row.address = values.address;
  record.row.postalCode = values.postalCode;
  record.row.city = values.city;
  record.row.country = values.country;
  record.row.repartition = values.repartition;
  record.photoNames = values.photoNames;
}

export function createImmeuble(state: DemoState, input: ImmeubleValues): { id: string } {
  const values = parseValues(state, input, null);
  const id = uniqueId(values.name, new Set(state.immeubles.map((item) => item.row.id)));
  const record: ImmeubleRecord = {
    row: {
      id,
      name: values.name,
      address: values.address,
      postalCode: values.postalCode,
      city: values.city,
      country: values.country,
      repartition: values.repartition,
      copropriete: false,
      archived: false,
    },
    tantiemesTotal: 0,
    builtYear: null,
    levels: null,
    heating: null,
    syndic: null,
    registration: null,
    totalLots: null,
    photoNames: values.photoNames,
    photoLabels: [],
    photoCount: values.photoNames.length,
  };
  state.immeubles.push(record);
  return { id };
}

export function updateImmeuble(state: DemoState, id: string, input: ImmeubleValues): void {
  const record = findImmeuble(state, id);
  apply(record, parseValues(state, input, id));
  state.lots.forEach((lot) => {
    if (lot.row.immeubleId === id) {
      lot.street = record.row.address;
      lot.postalCode = record.row.postalCode;
      lot.city = record.row.city;
    }
  });
}

export function setImmeubleArchived(state: DemoState, id: string, archived: boolean): void {
  const record = findImmeuble(state, id);
  if (archived) {
    const active = state.lots.filter((lot) => lot.row.immeubleId === id && !lot.row.archived).length;
    if (active > 0) {
      throw new BiensError(`L’immeuble compte ${String(active)} bien${active > 1 ? 's' : ''} actif${active > 1 ? 's' : ''} : archivez-les d’abord.`);
    }
  }
  record.row.archived = archived;
}

export function deleteImmeuble(state: DemoState, id: string): void {
  findImmeuble(state, id);
  if (state.lots.some((lot) => lot.row.immeubleId === id)) {
    throw new BiensError('Suppression impossible : des biens sont rattachés à cet immeuble. Archivez l’immeuble à la place.');
  }
  if (state.equipements.some((item) => item.row.immeubleId === id)) {
    throw new BiensError('Suppression impossible : des équipements sont rattachés à cet immeuble. Archivez l’immeuble à la place.');
  }
  state.immeubles = state.immeubles.filter((item) => item.row.id !== id);
  state.documents = state.documents.filter((item) => !(item.owner.kind === 'immeuble' && item.owner.id === id));
  Reflect.deleteProperty(state.immeubleExtras, id);
}
