import { formatDate } from '../dates';
import { creancesActives, joursRetard, resteCreance, resteDu, resteFacture } from '../derive';
import type { Creance, Dossier, FinancesData } from '../schemas';

export interface CreanceRef {
  kind: Creance['kind'];
  refId: string;
}

export const creanceKey = (ref: CreanceRef): string => `${ref.kind}:${ref.refId}`;

export interface CreanceOption extends CreanceRef {
  key: string;
  libelle: string;
  detail: string;
  due: string;
  reste: number;
}

export const dossierOuvert = (data: FinancesData, dossier: Dossier): boolean => creancesActives(dossier).some((creance) => resteCreance(data, creance) > 0);

export const openDossierOfBail = (data: FinancesData, bailId: string): Dossier | undefined =>
  data.dossiers.find((dossier) => dossier.bailId === bailId && dossierOuvert(data, dossier));

export const dossierOfCreance = (data: FinancesData, ref: CreanceRef): Dossier | undefined =>
  data.dossiers.find((dossier) => creancesActives(dossier).some((creance) => creance.kind === ref.kind && creance.refId === ref.refId));

export const dossierOfEcheance = (data: FinancesData, echeanceId: string): Dossier | undefined => dossierOfCreance(data, { kind: 'echeance', refId: echeanceId });

export const firstEcheanceId = (dossier: Dossier): string | null => creancesActives(dossier).find((creance) => creance.kind === 'echeance')?.refId ?? null;

export function creanceOptions(data: FinancesData, bailId: string): CreanceOption[] {
  const options: CreanceOption[] = [];
  for (const echeance of data.echeances) {
    const ref: CreanceRef = { kind: 'echeance', refId: echeance.id };
    const jours = joursRetard(echeance, data.today);
    if (echeance.bailId !== bailId || echeance.statut !== 'active' || resteDu(echeance) <= 0 || jours === 0 || dossierOfCreance(data, ref)) continue;
    options.push({ ...ref, key: creanceKey(ref), libelle: echeance.libelle, detail: `Échue le ${formatDate(echeance.echeance)}, ${String(jours)} jour${jours > 1 ? 's' : ''} de retard`, due: echeance.echeance, reste: resteDu(echeance) });
  }
  for (const facture of data.factures) {
    const ref: CreanceRef = { kind: 'facture', refId: facture.id };
    const reste = resteFacture(data, facture);
    const due = facture.echeance ?? facture.date;
    if (facture.bailId !== bailId || facture.dossierId !== null || reste <= 0 || due >= data.today || dossierOfCreance(data, ref)) continue;
    options.push({ ...ref, key: creanceKey(ref), libelle: `Facture ${facture.numero}, ${facture.objet}`, detail: `Échue le ${formatDate(due)}`, due, reste });
  }
  return options.sort((a, b) => a.due.localeCompare(b.due) || a.libelle.localeCompare(b.libelle));
}
