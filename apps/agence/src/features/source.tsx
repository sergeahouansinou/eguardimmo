"use client";

import { createContext, use } from "react";
import type { ReactNode } from "react";
import { createComptesRendusDemo } from "./comptes-rendus/demo";
import type { ComptesRendusSource } from "./comptes-rendus/source";
import { createCompteDemo } from "./compte/demo";
import type { CompteSource } from "./compte/source";
import { createConformiteDemo } from "./conformite/demo";
import type { ConformiteSource } from "./conformite/source";
import { createDocumentsDemo } from "./documents/demo";
import type { DocumentsSource } from "./documents/source";
import { createEquipeDemo } from "./equipe/demo";
import type { EquipeSource } from "./equipe/source";
import { createFinancesDemo } from "./finances/demo";
import type { FinancesSource } from "./finances/source";
import { createInterventionsDemo } from "./interventions/demo";
import type { InterventionsSource } from "./interventions/source";
import { createReglagesDemo } from "./reglages/demo";
import type { ReglagesSource } from "./reglages/source";

export interface AgenceSource {
  finances: FinancesSource;
  comptesRendus: ComptesRendusSource;
  interventions: InterventionsSource;
  conformite: ConformiteSource;
  documents: DocumentsSource;
  reglages: ReglagesSource;
  equipe: EquipeSource;
  compte: CompteSource;
}

export function createDemoSource(): AgenceSource {
  const finances = createFinancesDemo();
  const equipe = createEquipeDemo();
  return {
    finances,
    comptesRendus: createComptesRendusDemo({ finances }),
    interventions: createInterventionsDemo(),
    conformite: createConformiteDemo(),
    documents: createDocumentsDemo(),
    reglages: createReglagesDemo(),
    equipe,
    compte: createCompteDemo({ equipe }),
  };
}

const SourceContext = createContext<AgenceSource | null>(null);

let defaultSource: AgenceSource | null = null;

function getDefaultSource(): AgenceSource {
  defaultSource ??= createDemoSource();
  return defaultSource;
}

export function AgenceSourceProvider({ source, children }: { source: AgenceSource; children: ReactNode }) {
  return <SourceContext value={source}>{children}</SourceContext>;
}

export function useAgenceSource(): AgenceSource {
  return use(SourceContext) ?? getDefaultSource();
}
