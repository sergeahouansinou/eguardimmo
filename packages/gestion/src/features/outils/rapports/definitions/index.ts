import type { ReportDefinition } from '../engine/types';
import { echeancesRevisions, diagnosticsAssurances, etatLocatif, occupantsBiens } from './baux';
import { depensesParBien, depotsGarantie, regularisationCharges } from './charges';
import { exportComptable, revenusFonciers, tvaCollecteePayee } from './fiscal';
import { loyersAppeles, loyersImpayes, soldesLocataires } from './loyers';
import { pretsImmobiliers, rentabiliteBiens, valeurBiens } from './patrimoine';

export const REPORT_DEFINITIONS: readonly ReportDefinition[] = [
  loyersAppeles,
  loyersImpayes,
  soldesLocataires,
  depensesParBien,
  regularisationCharges,
  depotsGarantie,
  etatLocatif,
  echeancesRevisions,
  occupantsBiens,
  diagnosticsAssurances,
  revenusFonciers,
  exportComptable,
  tvaCollecteePayee,
  valeurBiens,
  pretsImmobiliers,
  rentabiliteBiens,
];

export const findDefinition = (slug: string): ReportDefinition | undefined => REPORT_DEFINITIONS.find((definition) => definition.slug === slug);
