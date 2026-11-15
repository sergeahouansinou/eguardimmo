'use client';

import { createCollection, NotFoundError } from '../locataires/kit/collection';
import { todayIso } from '../locataires/kit/dates';
import { nextSequence, uniqueSlug } from '../locataires/kit/ids';
import { createSourceContext } from '../locataires/kit/sourceContext';
import { demoCourriers, demoNotices, demoReceipts, demoSignatures, demoTemplates } from './demo';
import { receiptIdOf } from './paths';
import { courrierInputSchema, defaultSignatureFields, signatureInputSchema, templateInputSchema } from './schemas';
import type { CourrierStatus } from './schemas';

export interface CourriersSource {
  templates: () => Promise<unknown>;
  createTemplate: (input: unknown) => Promise<unknown>;
  updateTemplate: (id: string, input: unknown) => Promise<unknown>;
  duplicateTemplate: (id: string) => Promise<unknown>;
  setTemplateArchived: (id: string, archived: boolean) => Promise<unknown>;
  deleteTemplate: (id: string) => Promise<void>;
  courriers: () => Promise<unknown>;
  createCourrier: (input: unknown, status: Exclude<CourrierStatus, 'envoye'>) => Promise<unknown>;
  markCourrierSent: (id: string) => Promise<unknown>;
  deleteCourrier: (id: string) => Promise<void>;
  signatures: () => Promise<unknown>;
  createSignature: (input: unknown) => Promise<unknown>;
  cancelSignature: (id: string) => Promise<unknown>;
  remindSignature: (id: string) => Promise<unknown>;
  updateCourrier: (id: string, input: unknown) => Promise<unknown>;
  receipts: () => Promise<unknown>;
  emitReceipts: (month: string) => Promise<unknown>;
  markReceiptSent: (id: string) => Promise<unknown>;
  notices: () => Promise<unknown>;
  sendNotice: (id: string) => Promise<unknown>;
}

export function createDemoCourriersSource(): CourriersSource {
  const templates = createCollection('Modèle', demoTemplates);
  const courriers = createCollection('Courrier', demoCourriers);
  const signatures = createCollection('Signature', demoSignatures);
  const receipts = createCollection('Quittance', demoReceipts);
  const notices = createCollection('Avis d’échéance', demoNotices);
  const year = () => Number(todayIso().slice(0, 4));

  return {
    templates: () => Promise.resolve(templates.all()),
    createTemplate: (raw) => {
      const values = templateInputSchema.parse(raw);
      return Promise.resolve(
        templates.add({ id: uniqueSlug(values.name, templates.all().map((entry) => entry.id)), ...values, builtIn: false, archived: false, updatedOn: todayIso() }),
      );
    },
    updateTemplate: (id, raw) => {
      const current = templates.find(id);
      if (!current) return Promise.reject(new NotFoundError('Modèle', id));
      const values = templateInputSchema.parse(raw);
      return Promise.resolve(templates.patch(id, { ...values, updatedOn: todayIso() }));
    },
    duplicateTemplate: (id) => {
      const current = templates.find(id);
      if (!current) return Promise.reject(new NotFoundError('Modèle', id));
      const name = `${current.name}, copie`;
      return Promise.resolve(templates.add({ ...current, id: uniqueSlug(name, templates.all().map((entry) => entry.id)), name, builtIn: false, archived: false, updatedOn: todayIso() }));
    },
    setTemplateArchived: (id, archived) => {
      if (!templates.find(id)) return Promise.reject(new NotFoundError('Modèle', id));
      return Promise.resolve(templates.patch(id, { archived }));
    },
    deleteTemplate: (id) => {
      const current = templates.find(id);
      if (!current) return Promise.reject(new NotFoundError('Modèle', id));
      if (current.builtIn) return Promise.reject(new Error('Un modèle fourni ne peut pas être supprimé. Archivez-le.'));
      if (courriers.all().some((courrier) => courrier.templateId === id)) {
        return Promise.reject(new Error('Ce modèle a servi à des courriers. Archivez-le plutôt.'));
      }
      templates.remove(id);
      return Promise.resolve();
    },
    courriers: () => Promise.resolve(courriers.all()),
    createCourrier: (raw, status) => {
      const values = courrierInputSchema.parse(raw);
      const reference = nextSequence(courriers.all().map((entry) => entry.reference), 'CR', year(), 4);
      return Promise.resolve(
        courriers.add({
          id: reference.toLowerCase(),
          reference,
          templateId: values.templateId === '' ? null : values.templateId,
          tenantId: values.tenantId,
          unitId: values.unitId === '' ? null : values.unitId,
          subject: values.subject,
          body: values.body,
          status,
          channel: values.channel,
          createdOn: todayIso(),
          sentOn: null,
        }),
      );
    },
    markCourrierSent: (id) => {
      const current = courriers.find(id);
      if (!current) return Promise.reject(new NotFoundError('Courrier', id));
      if (current.status === 'envoye') return Promise.reject(new Error('Ce courrier a déjà été envoyé.'));
      return Promise.resolve(courriers.patch(id, { status: 'envoye', sentOn: todayIso() }));
    },
    deleteCourrier: (id) => {
      const current = courriers.find(id);
      if (!current) return Promise.reject(new NotFoundError('Courrier', id));
      if (current.status === 'envoye') return Promise.reject(new Error('Un courrier envoyé ne peut pas être supprimé.'));
      courriers.remove(id);
      return Promise.resolve();
    },
    signatures: () => Promise.resolve(signatures.all()),
    createSignature: (raw) => {
      const values = signatureInputSchema.parse(raw);
      const reference = nextSequence(signatures.all().map((entry) => entry.reference), 'SG', year(), 4);
      return Promise.resolve(
        signatures.add({
          id: reference.toLowerCase(),
          reference,
          title: values.title,
          fileName: values.fileName,
          signers: values.signers.map((signer) => ({ name: signer.name.trim(), email: signer.email.trim(), status: 'attente' as const })),
          status: 'en_cours',
          createdOn: todayIso(),
          completedOn: null,
          reminderSentOn: null,
          fields: values.fields && values.fields.length > 0 ? values.fields : defaultSignatureFields(values.signers.length),
        }),
      );
    },
    remindSignature: (id) => {
      const current = signatures.find(id);
      if (!current) return Promise.reject(new NotFoundError('Signature', id));
      if (current.status !== 'en_cours') return Promise.reject(new Error('Seule une demande en cours peut être relancée.'));
      return Promise.resolve(signatures.patch(id, { reminderSentOn: todayIso() }));
    },
    updateCourrier: (id, raw) => {
      const current = courriers.find(id);
      if (!current) return Promise.reject(new NotFoundError('Courrier', id));
      if (current.status === 'envoye') return Promise.reject(new Error('Un courrier envoyé ne peut plus être modifié.'));
      const values = courrierInputSchema.parse(raw);
      return Promise.resolve(
        courriers.patch(id, {
          templateId: values.templateId === '' ? null : values.templateId,
          tenantId: values.tenantId,
          unitId: values.unitId === '' ? null : values.unitId,
          subject: values.subject,
          body: values.body,
          channel: values.channel,
        }),
      );
    },
    cancelSignature: (id) => {
      const current = signatures.find(id);
      if (!current) return Promise.reject(new NotFoundError('Signature', id));
      if (current.status !== 'en_cours') return Promise.reject(new Error('Seule une demande en cours peut être annulée.'));
      return Promise.resolve(signatures.patch(id, { status: 'annule' }));
    },
    receipts: () => Promise.resolve(receipts.all()),
    emitReceipts: (month) => {
      const pending = receipts.all().filter((receipt) => receipt.number === null && receipt.month === month);
      if (pending.length === 0) return Promise.reject(new Error('Aucune quittance à émettre pour ce mois.'));
      const taken = receipts.all().map((receipt) => receipt.number ?? '');
      const emitted = pending.map((receipt) => {
        const number = nextSequence(taken, 'QT', year(), 4);
        taken.push(number);
        receipts.remove(receipt.id);
        return receipts.add({ ...receipt, id: receiptIdOf(number), number, issuedOn: todayIso(), sentOn: todayIso() });
      });
      return Promise.resolve(emitted);
    },
    markReceiptSent: (id) => {
      const current = receipts.find(id);
      if (!current?.number) return Promise.reject(new NotFoundError('Quittance', id));
      return Promise.resolve(receipts.patch(id, { sentOn: todayIso() }));
    },
    notices: () => Promise.resolve(notices.all()),
    sendNotice: (id) => {
      const current = notices.find(id);
      if (!current) return Promise.reject(new NotFoundError('Avis d’échéance', id));
      if (current.sentOn) return Promise.reject(new Error('Cet avis a déjà été envoyé.'));
      return Promise.resolve(notices.patch(id, { sentOn: todayIso() }));
    },
  };
}

const context = createSourceContext('courriers', createDemoCourriersSource);
export const CourriersSourceProvider = context.SourceProvider;
export const useCourriersSource = context.useSource;
