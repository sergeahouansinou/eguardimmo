'use client';

import { z } from 'zod';
import { createSourceContext, useScreenQuery, useSourceMutation } from '../kit';
import { createDemoAnalytiqueData } from './demo';
import { analytiqueDataSchema } from './schemas';

export const assumptionsSchema = z.object({
  irlBp: z.number().int().min(0).max(1000),
  growthBp: z.number().int().min(0).max(1000),
});

export type Assumptions = z.infer<typeof assumptionsSchema>;

export interface AnalytiqueSource {
  load: () => Promise<unknown>;
  updateAssumptions: (input: Assumptions) => Promise<void>;
}

export function createDemoAnalytiqueSource(): AnalytiqueSource {
  const base = createDemoAnalytiqueData();
  let assumptions: Assumptions = { irlBp: base.forecast.irlBp, growthBp: base.forecast.growthBp };
  return {
    load: () => Promise.resolve({ ...structuredClone(base), forecast: { ...structuredClone(base.forecast), ...assumptions } }),
    updateAssumptions: (input) => {
      assumptions = assumptionsSchema.parse(input);
      return Promise.resolve();
    },
  };
}

const context = createSourceContext<AnalytiqueSource>(createDemoAnalytiqueSource);

export const AnalytiqueSourceProvider = context.Provider;
export const useAnalytiqueSource = context.useSource;
export const resetAnalytiqueSource = context.resetDefault;

export const ANALYTIQUE_KEY = ['outils', 'analytique'] as const;

export function useAnalytiqueData() {
  const source = useAnalytiqueSource();
  return useScreenQuery(ANALYTIQUE_KEY, () => source.load(), analytiqueDataSchema);
}

export function useUpdateAssumptions() {
  const source = useAnalytiqueSource();
  return useSourceMutation((input: Assumptions) => source.updateAssumptions(input), [ANALYTIQUE_KEY]);
}
