'use client';

import { createCollection, NotFoundError } from '../locataires/kit/collection';
import { todayIso } from '../locataires/kit/dates';
import { createSourceContext } from '../locataires/kit/sourceContext';
import { demoCourriers, demoNotices, demoReceipts, demoSignatures, demoTemplates } from './demo';
import { createCourriersSource } from './sourceCourriers';
import { createReceiptsSource } from './sourceReceipts';
import { createSignaturesSource } from './sourceSignatures';
import { createTemplatesSource } from './sourceTemplates';
import type { CourriersSource } from './sourceTypes';

export type { CourriersSource, TemplateMode } from './sourceTypes';

export function createDemoCourriersSource(): CourriersSource {
  const templates = createCollection('Modèle', demoTemplates);
  const courriers = createCollection('Courrier', demoCourriers);
  const signatures = createCollection('Signature', demoSignatures);
  const notices = createCollection('Avis d’échéance', demoNotices);

  return {
    ...createTemplatesSource(templates, courriers),
    ...createCourriersSource(courriers),
    ...createSignaturesSource(signatures),
    ...createReceiptsSource(demoReceipts),
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
