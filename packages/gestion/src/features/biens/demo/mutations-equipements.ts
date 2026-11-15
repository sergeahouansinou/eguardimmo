import { BiensError } from '../errors';
import type { LogEntryInput, OperationInput } from '../source';
import { addMonths, daysBetween } from '../lib/dates';
import { uniqueId } from '../lib/text';
import { equipementValuesSchema } from '../schemas/equipements';
import type { EquipementRow, EquipementValues } from '../schemas/equipements';
import { AS_OF } from './records';
import type { EquipementRecord } from './records';
import { placeNameOf } from './read-equipements';
import type { DemoState } from './state';

function findEquipement(state: DemoState, id: string): EquipementRecord {
  const record = state.equipements.find((item) => item.row.id === id);
  if (!record) throw new BiensError('Équipement introuvable.');
  return record;
}

function applyValues(state: DemoState, row: EquipementRow, input: EquipementValues): void {
  const parsed = equipementValuesSchema.safeParse(input);
  if (!parsed.success) throw new BiensError('Les informations de l’équipement sont invalides.');
  const values = parsed.data;
  const lot = values.lotId ? state.lots.find((item) => item.row.id === values.lotId) : null;
  if (values.lotId && !lot) throw new BiensError('Bien introuvable.');
  const immeubleId = lot ? lot.row.immeubleId : values.immeubleId;
  if (!immeubleId || !state.immeubles.some((item) => item.row.id === immeubleId)) {
    throw new BiensError('Choisissez le bien ou l’immeuble où se trouve l’équipement.');
  }
  if (values.purchasedOn && values.warrantyEndsOn && values.warrantyEndsOn < values.purchasedOn) {
    throw new BiensError('La garantie finit avant l’achat.');
  }
  row.name = values.name;
  row.detail = values.detail;
  row.family = values.family;
  row.lotId = values.lotId;
  row.immeubleId = immeubleId;
  row.room = values.room === '' ? null : values.room;
  row.brand = values.brand === '' ? null : values.brand;
  row.model = values.model === '' ? null : values.model;
  row.purchasedOn = values.purchasedOn;
  row.price = values.price;
  row.warrantyEndsOn = values.warrantyEndsOn;
  row.chargedTo = values.chargedTo;
  row.placeName = placeNameOf(state, row);
}

export function createEquipement(state: DemoState, input: EquipementValues): { id: string } {
  const row: EquipementRow = {
    id: uniqueId(input.name, new Set(state.equipements.map((item) => item.row.id))),
    name: input.name,
    detail: '',
    family: input.family,
    lotId: null,
    immeubleId: null,
    placeName: '—',
    room: null,
    brand: null,
    model: null,
    purchasedOn: null,
    price: null,
    warrantyEndsOn: null,
    warrantyNote: null,
    nextMaintenanceOn: null,
    maintenanceNote: null,
    chargedTo: 'bailleur',
    status: 'en_service',
    provider: null,
    lastVisitOn: null,
    obligation: null,
    contractYearly: null,
    archived: false,
  };
  applyValues(state, row, input);
  state.equipements.push({ row, rich: null, plan: [], log: [], photoNames: input.photoNames });
  return { id: row.id };
}

export function updateEquipement(state: DemoState, id: string, input: EquipementValues): void {
  const record = findEquipement(state, id);
  const draft = { ...record.row };
  applyValues(state, draft, input);
  record.row = draft;
  record.photoNames = input.photoNames;
}

export function setEquipementArchived(state: DemoState, id: string, archived: boolean): void {
  findEquipement(state, id).row.archived = archived;
}

export function deleteEquipement(state: DemoState, id: string): void {
  findEquipement(state, id);
  state.equipements = state.equipements.filter((item) => item.row.id !== id);
  state.documents = state.documents.filter((item) => !(item.owner.kind === 'equipement' && item.owner.id === id));
}

export function addLogEntry(state: DemoState, equipementId: string, input: LogEntryInput): void {
  const record = findEquipement(state, equipementId);
  const title = input.title.trim();
  if (title === '') throw new BiensError('Le titre de l’entrée est requis.');
  if (input.cost !== null && input.cost < 0) throw new BiensError('Le coût ne peut pas être négatif.');
  const done = input.date <= AS_OF;
  record.log = [
    ...record.log,
    {
      id: uniqueId(`log-${title}`, new Set(record.log.map((entry) => entry.id))),
      title,
      date: input.date,
      detail: input.detail.trim(),
      done,
      cost: input.cost,
    },
  ].sort((a, b) => b.date.localeCompare(a.date));
  if (done && input.date > (record.row.lastVisitOn ?? '')) record.row.lastVisitOn = input.date;
}

export function addOperation(state: DemoState, equipementId: string, input: OperationInput): void {
  const record = findEquipement(state, equipementId);
  const label = input.label.trim();
  if (label === '') throw new BiensError('Le libellé de l’opération est requis.');
  if (!Number.isInteger(input.periodicityMonths) || input.periodicityMonths < 1 || input.periodicityMonths > 240) {
    throw new BiensError('La périodicité doit être comprise entre 1 et 240 mois.');
  }
  if (input.lastOn !== null && input.lastOn > AS_OF) throw new BiensError('La dernière réalisation ne peut pas être dans le futur.');
  const nextOn = input.lastOn === null ? null : addMonths(input.lastOn, input.periodicityMonths);
  const status =
    nextOn === null
      ? { label: 'À planifier', tone: 'neutral' as const }
      : nextOn < AS_OF
        ? { label: 'En retard', tone: 'danger' as const }
        : daysBetween(AS_OF, nextOn) <= 60
          ? { label: 'Bientôt', tone: 'warning' as const }
          : { label: 'Planifié', tone: 'info' as const };
  record.plan = [
    ...record.plan,
    {
      id: uniqueId(label, new Set(record.plan.map((item) => item.id))),
      label,
      doneBy: input.doneBy.trim() === '' ? 'Propriétaire' : input.doneBy.trim(),
      periodicity: `Tous les ${String(input.periodicityMonths)} mois`,
      lastOn: input.lastOn,
      nextOn,
      reminder: 'Rappel 30 jours avant',
      status,
    },
  ];
  const upcoming = record.plan.map((item) => item.nextOn).filter((date): date is string => date !== null).sort();
  record.row.nextMaintenanceOn = upcoming[0] ?? null;
}
