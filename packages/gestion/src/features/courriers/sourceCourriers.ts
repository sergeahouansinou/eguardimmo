import type { DemoCollection } from '../locataires/kit/collection';
import { NotFoundError } from '../locataires/kit/collection';
import { todayIso } from '../locataires/kit/dates';
import { nextSequence } from '../locataires/kit/ids';
import { courrierInputSchema } from './schemas';
import type { Courrier } from './schemas';
import type { CourriersSource } from './sourceTypes';

type CourriersApi = Pick<CourriersSource, 'courriers' | 'createCourrier' | 'updateCourrier' | 'markCourrierSent' | 'resendCourrier' | 'setCourrierArchived' | 'deleteCourrier'>;

export function createCourriersSource(courriers: DemoCollection<Courrier>): CourriersApi {
  const year = () => Number(todayIso().slice(0, 4));

  return {
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
          updatedOn: todayIso(),
          archived: false,
          sendings: [],
        }),
      );
    },
    updateCourrier: (id, raw) => {
      const current = courriers.find(id);
      if (!current) return Promise.reject(new NotFoundError('Courrier', id));
      if (current.status === 'envoye') return Promise.reject(new Error('Un courrier envoyé ne peut plus être modifié.'));
      if (current.archived) return Promise.reject(new Error('Un courrier archivé ne peut plus être modifié. Désarchivez-le d’abord.'));
      const values = courrierInputSchema.parse(raw);
      return Promise.resolve(
        courriers.patch(id, {
          templateId: values.templateId === '' ? null : values.templateId,
          tenantId: values.tenantId,
          unitId: values.unitId === '' ? null : values.unitId,
          subject: values.subject,
          body: values.body,
          channel: values.channel,
          updatedOn: todayIso(),
        }),
      );
    },
    markCourrierSent: (id) => {
      const current = courriers.find(id);
      if (!current) return Promise.reject(new NotFoundError('Courrier', id));
      if (current.status === 'envoye') return Promise.reject(new Error('Ce courrier a déjà été envoyé.'));
      if (current.archived) return Promise.reject(new Error('Un courrier archivé ne peut pas être envoyé. Désarchivez-le d’abord.'));
      const today = todayIso();
      return Promise.resolve(
        courriers.patch(id, { status: 'envoye', sentOn: today, updatedOn: today, sendings: [...current.sendings, { on: today, channel: current.channel, resend: false }] }),
      );
    },
    resendCourrier: (id) => {
      const current = courriers.find(id);
      if (!current) return Promise.reject(new NotFoundError('Courrier', id));
      if (current.status !== 'envoye') return Promise.reject(new Error('Seul un courrier envoyé peut être renvoyé.'));
      if (current.archived) return Promise.reject(new Error('Un courrier archivé ne peut pas être renvoyé. Désarchivez-le d’abord.'));
      const today = todayIso();
      return Promise.resolve(
        courriers.patch(id, { sentOn: today, updatedOn: today, sendings: [...current.sendings, { on: today, channel: current.channel, resend: true }] }),
      );
    },
    setCourrierArchived: (id, archived) => {
      const current = courriers.find(id);
      if (!current) return Promise.reject(new NotFoundError('Courrier', id));
      if (current.archived === archived) return Promise.reject(new Error(archived ? 'Ce courrier est déjà archivé.' : 'Ce courrier n’est pas archivé.'));
      return Promise.resolve(courriers.patch(id, { archived, updatedOn: todayIso() }));
    },
    deleteCourrier: (id) => {
      const current = courriers.find(id);
      if (!current) return Promise.reject(new NotFoundError('Courrier', id));
      if (current.status === 'envoye') return Promise.reject(new Error('Un courrier envoyé ne peut pas être supprimé.'));
      courriers.remove(id);
      return Promise.resolve();
    },
  };
}
