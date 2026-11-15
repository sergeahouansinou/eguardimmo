'use client';

import { createSourceContext, useScreenQuery } from '../../outils/kit';
import type { ScreenQuery } from '../../outils/kit';
import { createDemoInterventionsSource } from './demo';
import { interventionListSchema } from './schemas';
import type { Intervention, InterventionInput, InterventionStatus, QuoteInput, QuoteStatus } from './schemas';

export interface InterventionsSource {
  list: () => Promise<unknown>;
  create: (draft: InterventionInput) => Promise<unknown>;
  update: (id: string, draft: InterventionInput) => Promise<unknown>;
  assign: (id: string, intervenant: string | null) => Promise<unknown>;
  notifyTenant: (id: string, message: string) => Promise<unknown>;
  recordQuote: (id: string, quote: QuoteInput) => Promise<unknown>;
  decideQuote: (id: string, status: Exclude<QuoteStatus, 'a_valider'>) => Promise<unknown>;
  setStatus: (id: string, status: InterventionStatus) => Promise<unknown>;
  setArchived: (id: string, archived: boolean) => Promise<unknown>;
  remove: (id: string) => Promise<void>;
}

const context = createSourceContext(createDemoInterventionsSource);

export const InterventionsSourceProvider = context.Provider;
export const useInterventionsSource = context.useSource;
export const resetInterventionsDemo = context.resetDefault;

export const INTERVENTIONS_KEY = ['suivi', 'interventions'] as const;

export function useInterventions(): ScreenQuery<Intervention[]> {
  const source = useInterventionsSource();
  return useScreenQuery(INTERVENTIONS_KEY, source.list, interventionListSchema);
}
