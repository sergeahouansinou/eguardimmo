'use client';

import { createCollection, NotFoundError } from '../locataires/kit/collection';
import { addDays, addMonths, todayIso } from '../locataires/kit/dates';
import { nextSequence, uniqueSlug } from '../locataires/kit/ids';
import { parseEuros } from '../locataires/kit/money';
import { createSourceContext } from '../locataires/kit/sourceContext';
import {
  buildExtras,
  buildInstallments,
  demoAttestations,
  demoEdls,
  demoEdlTemplates,
  demoExits,
  demoLeases,
  demoReservations,
} from './demo';
import { edlInputSchema, leaseInputSchema, noticeInputSchema } from './schemas';
import type { Attestation, EdlStatus, ExitStep, Lease, LeaseExit, LeaseStatus } from './schemas';

export interface ReturnContext {
  tenantName: string;
  tenantCivility: string;
}

export interface BauxSource {
  leases: () => Promise<unknown>;
  installments: (leaseId: string) => Promise<unknown>;
  extras: (leaseId: string) => Promise<unknown>;
  exits: () => Promise<unknown>;
  createLease: (input: unknown) => Promise<unknown>;
  updateLease: (id: string, input: unknown) => Promise<unknown>;
  duplicateLease: (id: string) => Promise<unknown>;
  deleteLease: (id: string) => Promise<void>;
  recordNotice: (leaseId: string, input: unknown) => Promise<unknown>;
  setExitStep: (leaseId: string, stepId: string, status: ExitStep['status']) => Promise<unknown>;
  markReturned: (leaseId: string, context: ReturnContext) => Promise<unknown>;
  edlTemplates: () => Promise<unknown>;
  edls: () => Promise<unknown>;
  createEdl: (input: unknown, asDraft: boolean) => Promise<unknown>;
  updateEdl: (id: string, input: unknown) => Promise<unknown>;
  setEdlStatus: (id: string, status: EdlStatus) => Promise<unknown>;
  setEdlArchived: (id: string, archived: boolean) => Promise<unknown>;
  deleteEdl: (id: string) => Promise<void>;
  reservations: () => Promise<unknown>;
  confirmReservation: (id: string) => Promise<unknown>;
  cancelReservation: (id: string) => Promise<unknown>;
  duplicateReservation: (id: string) => Promise<unknown>;
  attestations: () => Promise<unknown>;
}

const DEFAULT_STEPS: readonly Omit<ExitStep, 'status'>[] = [
  { id: 'preavis', title: 'Préavis reçu', detail: '' },
  { id: 'pre-visite', title: 'Visite de pré-sortie', detail: 'À proposer au locataire' },
  { id: 'edl-sortie', title: 'État des lieux de sortie', detail: 'Contradictoire, le jour du départ' },
  { id: 'chiffrage', title: 'Chiffrage des réparations', detail: 'Comparé à l’état des lieux d’entrée' },
  { id: 'decompte', title: 'Décompte du dépôt', detail: 'Dans le mois si l’état des lieux est conforme' },
  { id: 'restitution', title: 'Restitution et attestation', detail: 'Attestation générée automatiquement' },
  { id: 'cloture', title: 'Clôture du bail', detail: 'Archivage et fin des échéances' },
];

const dateFr = (iso: string) => iso.split('-').reverse().join('/');

function statusFor(start: string, asDraft: boolean): LeaseStatus {
  if (asDraft) return 'brouillon';
  return start > todayIso() ? 'a_venir' : 'en_cours';
}

function fingerprint(seed: string): string {
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  const hex = hash.toString(16).padStart(8, '0');
  return `${hex.slice(0, 4)}…${hex.slice(4)}`;
}

function findOverlap(all: readonly Lease[], fields: Pick<Lease, 'unitId' | 'start' | 'end' | 'status'>, selfId?: string): Lease | undefined {
  if (fields.status === 'brouillon') return undefined;
  return all.find(
    (other) => other.id !== selfId && other.unitId === fields.unitId && (other.status === 'en_cours' || other.status === 'preavis') && other.end >= fields.start && other.start <= fields.end,
  );
}

export function createDemoBauxSource(): BauxSource {
  const leases = createCollection('Bail', demoLeases);
  const edls = createCollection('État des lieux', demoEdls);
  const reservations = createCollection('Réservation', demoReservations);
  const attestations = createCollection('Attestation', demoAttestations);
  const exits = new Map<string, LeaseExit>(Object.entries(demoExits).map(([key, value]) => [key, structuredClone(value)]));

  const requireLease = (id: string): Lease => {
    const found = leases.find(id);
    if (!found) throw new NotFoundError('Bail', id);
    return found;
  };

  const fieldsFromInput = (raw: unknown) => {
    const values = leaseInputSchema.parse(raw);
    const start = values.start === '' ? todayIso() : values.start;
    const duration = /^\d+$/.test(values.durationMonths) && Number(values.durationMonths) > 0 ? Number(values.durationMonths) : values.furnished ? 12 : 36;
    return {
      values,
      fields: {
        unitId: values.unitId,
        tenantIds: values.tenantIds,
        furnished: values.furnished,
        durationMonths: duration,
        legalNote: values.furnished ? 'Location meublée, loi de 1989' : 'Location vide, loi de 1989',
        start,
        end: addDays(addMonths(start, duration), -1),
        rent: values.rent.trim() === '' ? 0 : parseEuros(values.rent),
        charges: values.charges.trim() === '' ? 0 : parseEuros(values.charges),
        deposit: values.deposit.trim() === '' ? 0 : parseEuros(values.deposit),
        dueDay: /^\d+$/.test(values.dueDay) ? Number(values.dueDay) : 1,
        paymentMethod: values.paymentMethod,
        nextRevision: addMonths(start, 12),
        tacitNote: values.furnished ? 'Reconduction tacite, 1 an' : 'Reconduction tacite, 3 ans',
        note: values.note,
        status: statusFor(start, values.asDraft),
      },
    };
  };

  const requireExit = (leaseId: string): LeaseExit => {
    const found = exits.get(leaseId);
    if (!found) throw new Error('Aucun préavis enregistré pour ce bail.');
    return found;
  };

  return {
    leases: () => Promise.resolve(leases.all()),
    installments: (leaseId) => Promise.resolve(buildInstallments(requireLease(leaseId))),
    extras: (leaseId) => Promise.resolve(buildExtras(requireLease(leaseId))),
    exits: () => Promise.resolve([...exits.values()].map((entry) => structuredClone(entry))),
    createLease: (raw) => {
      const { fields } = fieldsFromInput(raw);
      const taken = leases.all();
      const overlapping = findOverlap(taken, fields);
      if (overlapping) return Promise.reject(new Error(`Ce bien est déjà loué sur cette période (bail ${overlapping.reference}).`));
      const year = Number(todayIso().slice(0, 4));
      return Promise.resolve(
        leases.add({
          id: uniqueSlug(fields.unitId, taken.map((lease) => lease.id)),
          reference: nextSequence(taken.map((lease) => lease.reference), 'BL', year, 4),
          depositReceivedOn: null,
          revisionIndex: 'IRL',
          revisionNote: 'Indice IRL, à la date anniversaire',
          rentControl: '',
          guarantor: null,
          balance: 0,
          archived: false,
          ...fields,
        }),
      );
    },
    updateLease: (id, raw) => {
      const current = requireLease(id);
      if (current.status === 'termine') return Promise.reject(new Error('Un bail terminé ne peut plus être modifié.'));
      const { fields } = fieldsFromInput(raw);
      const overlapping = findOverlap(leases.all(), fields, id);
      if (overlapping) return Promise.reject(new Error(`Ce bien est déjà loué sur cette période (bail ${overlapping.reference}).`));
      const status: LeaseStatus = current.status === 'preavis' ? 'preavis' : fields.status;
      return Promise.resolve(leases.patch(id, { ...fields, status }));
    },
    duplicateLease: (id) => {
      const source = requireLease(id);
      const taken = leases.all();
      const start = addDays(source.end, 1);
      const year = Number(todayIso().slice(0, 4));
      return Promise.resolve(
        leases.add({
          ...source,
          id: uniqueSlug(source.unitId, taken.map((lease) => lease.id)),
          reference: nextSequence(taken.map((lease) => lease.reference), 'BL', year, 4),
          start,
          end: addDays(addMonths(start, source.durationMonths), -1),
          nextRevision: addMonths(start, 12),
          depositReceivedOn: null,
          balance: 0,
          status: 'brouillon',
          note: `Copie du bail ${source.reference}.`,
        }),
      );
    },
    deleteLease: (id) => {
      const lease = requireLease(id);
      if (lease.status !== 'brouillon') {
        return Promise.reject(new Error('Seul un brouillon peut être supprimé. Un bail émis se résilie.'));
      }
      leases.remove(id);
      return Promise.resolve();
    },
    recordNotice: (leaseId, raw) => {
      const lease = requireLease(leaseId);
      if (lease.status !== 'en_cours' && lease.status !== 'preavis') {
        return Promise.reject(new Error('Un préavis ne peut être enregistré que sur un bail en cours.'));
      }
      const values = noticeInputSchema.parse(raw);
      if (values.departure < values.noticeReceivedOn) {
        return Promise.reject(new Error('La date de départ ne peut pas précéder la réception du préavis.'));
      }
      const previous = exits.get(leaseId);
      const next: LeaseExit = {
        leaseId,
        noticeReceivedOn: values.noticeReceivedOn,
        noticeKind: previous?.noticeKind ?? 'lettre recommandée',
        noticeDuration: lease.furnished ? '1 mois, meublé' : '3 mois, location vide',
        departure: values.departure,
        lastInstallment: values.departure.slice(0, 7),
        reason: values.reason,
        steps:
          previous?.steps ??
          DEFAULT_STEPS.map((step) => ({
            ...step,
            detail: step.id === 'preavis' ? `${dateFr(values.noticeReceivedOn)}, lettre recommandée` : step.detail,
            status: step.id === 'preavis' ? 'fait' : step.id === 'pre-visite' ? 'a_planifier' : step.id === 'edl-sortie' ? 'prevu' : 'a_faire',
          })),
        repairs: previous?.repairs ?? [],
        unpaid: previous?.unpaid ?? (lease.balance < 0 ? -lease.balance : 0),
        chargesRegularisation: previous?.chargesRegularisation ?? 0,
        depositReturned: false,
        attestationId: null,
      };
      exits.set(leaseId, next);
      leases.patch(leaseId, { status: 'preavis', note: `Préavis reçu, départ le ${dateFr(values.departure)}.` });
      return Promise.resolve(structuredClone(next));
    },
    setExitStep: (leaseId, stepId, status) => {
      const current = requireExit(leaseId);
      if (!current.steps.some((step) => step.id === stepId)) return Promise.reject(new NotFoundError('Étape', stepId));
      const next = { ...current, steps: current.steps.map((step) => (step.id === stepId ? { ...step, status } : step)) };
      exits.set(leaseId, next);
      return Promise.resolve(structuredClone(next));
    },
    markReturned: (leaseId, context) => {
      const lease = requireLease(leaseId);
      const current = requireExit(leaseId);
      if (current.depositReturned) return Promise.reject(new Error('Le dépôt de garantie a déjà été restitué.'));
      const done = (id: string) => current.steps.find((step) => step.id === id)?.status === 'fait';
      if (!done('edl-sortie') || !done('decompte')) {
        return Promise.reject(new Error('Terminez l’état des lieux de sortie et le décompte du dépôt avant la restitution.'));
      }
      const deductions = current.repairs
        .filter((repair) => repair.imputation === 'degradation' && repair.estimate > 0)
        .map((repair) => ({ id: repair.id, label: repair.element, reference: 'EDL sortie', amount: repair.estimate }));
      const withheld = deductions.reduce((sum, line) => sum + line.amount, 0) + current.unpaid + current.chargesRegularisation;
      const all = attestations.all();
      const year = Number(todayIso().slice(0, 4));
      const number = nextSequence(all.map((entry) => entry.number), 'AT', year, 4);
      const attestation: Attestation = attestations.add({
        id: uniqueSlug(number, all.map((entry) => entry.id)),
        number,
        leaseId,
        leaseReference: lease.reference,
        tenantName: context.tenantName,
        tenantCivility: context.tenantCivility,
        unitId: lease.unitId,
        leaseStart: lease.start,
        leaseEnd: current.departure,
        exitDate: current.departure,
        issuedOn: todayIso(),
        issuedAt: new Date().toISOString(),
        deposit: lease.deposit,
        depositReceivedOn: lease.depositReceivedOn ?? lease.start,
        deductions,
        unpaid: current.unpaid,
        returned: Math.max(0, lease.deposit - withheld),
        fingerprint: fingerprint(number),
        paymentMethod: lease.paymentMethod,
      });
      exits.set(leaseId, {
        ...current,
        depositReturned: true,
        attestationId: attestation.id,
        steps: current.steps.map((step) => (step.id === 'restitution' || step.id === 'cloture' ? { ...step, status: 'fait' } : step)),
      });
      leases.patch(leaseId, { status: 'termine', end: current.departure });
      return Promise.resolve(attestation);
    },
    edlTemplates: () => Promise.resolve([...demoEdlTemplates]),
    edls: () => Promise.resolve(edls.all()),
    createEdl: (raw, asDraft) => {
      const values = edlInputSchema.parse(raw);
      const all = edls.all();
      const year = Number(todayIso().slice(0, 4));
      const reference = nextSequence(all.map((entry) => entry.reference), 'EDL', year, 3);
      return Promise.resolve(
        edls.add({
          id: reference.toLowerCase(),
          reference,
          type: values.type,
          unitId: values.unitId,
          tenantId: values.tenantId === '' ? null : values.tenantId,
          date: values.date,
          createdOn: todayIso(),
          templateId: values.templateId,
          status: asDraft ? 'brouillon' : 'prevu',
          rooms: values.rooms,
          archived: false,
        }),
      );
    },
    updateEdl: (id, raw) => {
      const current = edls.find(id);
      if (!current) return Promise.reject(new NotFoundError('État des lieux', id));
      if (current.status === 'signe') return Promise.reject(new Error('Un état des lieux signé ne peut plus être modifié.'));
      const values = edlInputSchema.parse(raw);
      return Promise.resolve(
        edls.patch(id, {
          type: values.type,
          unitId: values.unitId,
          tenantId: values.tenantId === '' ? null : values.tenantId,
          date: values.date,
          templateId: values.templateId,
          rooms: values.rooms,
        }),
      );
    },
    setEdlStatus: (id, status) => {
      const current = edls.find(id);
      if (!current) return Promise.reject(new NotFoundError('État des lieux', id));
      if (status === 'signe' && current.date === null) return Promise.reject(new Error('Planifiez une date avant de signer l’état des lieux.'));
      return Promise.resolve(edls.patch(id, { status }));
    },
    setEdlArchived: (id, archived) => Promise.resolve(edls.patch(id, { archived })),
    deleteEdl: (id) => {
      const current = edls.find(id);
      if (!current) return Promise.reject(new NotFoundError('État des lieux', id));
      if (current.status !== 'brouillon') return Promise.reject(new Error('Seul un brouillon peut être supprimé. Archivez les autres.'));
      edls.remove(id);
      return Promise.resolve();
    },
    reservations: () => Promise.resolve(reservations.all()),
    confirmReservation: (id) => {
      const current = reservations.find(id);
      if (!current) return Promise.reject(new NotFoundError('Réservation', id));
      if (current.status !== 'option') return Promise.reject(new Error('Seule une option peut être confirmée.'));
      return Promise.resolve(reservations.patch(id, { status: 'confirmee', optionUntil: null }));
    },
    cancelReservation: (id) => {
      const current = reservations.find(id);
      if (!current) return Promise.reject(new NotFoundError('Réservation', id));
      if (current.status === 'annulee') return Promise.reject(new Error('Cette réservation est déjà annulée.'));
      return Promise.resolve(reservations.patch(id, { status: 'annulee', optionUntil: null }));
    },
    duplicateReservation: (id) => {
      const current = reservations.find(id);
      if (!current) return Promise.reject(new NotFoundError('Réservation', id));
      const all = reservations.all();
      const year = Number(todayIso().slice(0, 4));
      const reference = nextSequence(all.map((entry) => entry.reference), 'RS', year, 3);
      return Promise.resolve(
        reservations.add({
          ...current,
          id: reference.toLowerCase(),
          reference,
          paid: 0,
          status: 'option',
          optionUntil: addDays(todayIso(), 7),
        }),
      );
    },
    attestations: () => Promise.resolve(attestations.all()),
  };
}

const context = createSourceContext('baux', createDemoBauxSource);
export const BauxSourceProvider = context.SourceProvider;
export const useBauxSource = context.useSource;
