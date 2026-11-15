'use client';

import { createContext, use } from 'react';
import type { ReactNode } from 'react';
import { financesCommandSchema } from './commands';
import type { CommandResult } from './commands';
import { createDemoFinances, DEMO_NOW } from './demo';
import { reduceCommand, FinancesCommandError } from './reducer';
import { financesSchema } from './schemas';
import type { FinancesData } from './schemas';
import { sealMissing, verifySeal } from './seal';

export interface FinancesSource {
  snapshot: () => Promise<unknown>;
  dispatch: (command: unknown) => Promise<CommandResult>;
  verifySeal: (kind: 'facture' | 'recu', id: string) => Promise<boolean>;
}

export interface DemoSourceOptions {
  seed?: FinancesData;
  now?: string;
}

export function createDemoFinancesSource({ seed = createDemoFinances(), now = DEMO_NOW }: DemoSourceOptions = {}): FinancesSource {
  let state = structuredClone(seed);
  let counter = 0;
  const replays = new Map<string, CommandResult>();
  const ready = sealMissing(state);
  let chain: Promise<unknown> = Promise.resolve();
  const serialize = <T,>(task: () => Promise<T>): Promise<T> => {
    const run = chain.then(task, task);
    chain = run.catch(() => undefined);
    return run;
  };
  const ctx = { now, id: (prefix: string) => `${prefix}-${String((counter += 1))}` };

  return {
    snapshot: async () => {
      await ready;
      return structuredClone(state);
    },
    dispatch: (raw) =>
      serialize(async () => {
      await ready;
      const parsed = financesCommandSchema.safeParse(raw);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new FinancesCommandError(`Données invalides${issue ? ` (${issue.path.join('.')} : ${issue.message})` : ''}.`);
      }
      const command = parsed.data;
      const replay = replays.get(command.requestKey);
      if (replay) return replay;
      const { data, outcome } = reduceCommand(state, ctx, command);
      await sealMissing(data);
      state = data;
      const result: CommandResult = { message: outcome.message, href: outcome.href ?? null, id: outcome.id ?? null };
      replays.set(command.requestKey, result);
      return result;
      }),
    verifySeal: async (kind, id) => {
      await ready;
      return verifySeal(state, kind, id);
    },
  };
}

const SourceContext = createContext<FinancesSource | null>(null);
let sharedSource: FinancesSource | null = null;

export function FinancesSourceProvider({ source, children }: { source: FinancesSource; children: ReactNode }) {
  return <SourceContext value={source}>{children}</SourceContext>;
}

// Sans fournisseur, une source de démonstration unique par session sert les écrans.
export function useFinancesSource(): FinancesSource {
  const provided = use(SourceContext);
  if (provided) return provided;
  sharedSource ??= createDemoFinancesSource();
  return sharedSource;
}

export function parseFinances(raw: unknown): FinancesData {
  return financesSchema.parse(raw);
}
