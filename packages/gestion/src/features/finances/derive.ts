import { addMonths, daysBetween, monthOf } from './dates';
import { divRound, percentOf, splitEvenly, sum } from './money';
import type { Bail, Bilan, BilanLigne, Dossier, Echeance, FinancesData, Pret } from './schemas';

export const resteDu = (echeance: Echeance): number => echeance.montant - echeance.paye;

export const slugify = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export function bailOf(data: FinancesData, bailId: string): Bail | undefined {
  return data.baux.find((bail) => bail.id === bailId);
}

export function bailOfEcheance(data: FinancesData, echeance: Echeance): Bail | undefined {
  return bailOf(data, echeance.bailId);
}

export const joursRetard = (echeance: Echeance, today: string): number => Math.max(0, daysBetween(echeance.echeance, today));

export type EcheanceEtat = 'solde' | 'trop_percu' | 'retard' | 'partiel' | 'a_venir' | 'annulee' | 'irrecouvrable';

export function echeanceEtat(echeance: Echeance, today: string): EcheanceEtat {
  if (echeance.statut === 'annulee') return 'annulee';
  if (echeance.statut === 'irrecouvrable') return 'irrecouvrable';
  const reste = resteDu(echeance);
  if (reste < 0) return 'trop_percu';
  if (reste === 0) return 'solde';
  if (joursRetard(echeance, today) === 0) return 'a_venir';
  return reste * 10 >= echeance.montant ? 'retard' : 'partiel';
}

export const isOpen = (echeance: Echeance): boolean => echeance.statut === 'active' && resteDu(echeance) !== 0;

export function impayes(data: FinancesData): Echeance[] {
  return data.echeances
    .filter((echeance) => echeance.statut === 'active' && resteDu(echeance) > 0 && joursRetard(echeance, data.today) > 0)
    .sort((a, b) => joursRetard(b, data.today) - joursRetard(a, data.today) || resteDu(b) - resteDu(a));
}

export function lastReminder(data: FinancesData, echeanceId: string): string | null {
  const dates = data.relances.filter((relance) => relance.echeanceId === echeanceId && relance.amiable).map((relance) => relance.date);
  return dates.length === 0 ? null : dates.reduce((latest, date) => (date > latest ? date : latest));
}

export interface PeriodKpis {
  attendu: number;
  encaisse: number;
  depenses: number;
  reparations: number;
  resultat: number;
}

export function periodKpis(data: FinancesData, month: string): PeriodKpis {
  const echeances = data.echeances.filter((echeance) => echeance.statut === 'active' && monthOf(echeance.echeance) === month);
  const depenses = data.depenses.filter((depense) => !depense.annulee && !depense.nonComptabilise && monthOf(depense.date) === month);
  const encaisse = sum(echeances.map((echeance) => Math.min(echeance.paye, echeance.montant)));
  const total = sum(depenses.map((depense) => depense.montantTtc));
  return {
    attendu: sum(echeances.map((echeance) => echeance.montant)),
    encaisse,
    depenses: total,
    reparations: sum(depenses.filter((depense) => depense.type === 'reparation').map((depense) => depense.montantTtc)),
    resultat: encaisse - total,
  };
}

export interface RemindersSummary {
  total: number;
  recommandes: number;
}

export function monthReminders(data: FinancesData, month: string): RemindersSummary {
  const relances = data.relances.filter((relance) => monthOf(relance.date) === month);
  return { total: relances.length, recommandes: relances.filter((relance) => relance.canal === 'recommande').length };
}

export function nextNumber(data: FinancesData, prefix: 'FA' | 'AV' | 'RC'): string {
  const year = data.today.slice(0, 4);
  return `${prefix}-${year}-${String(data.sequences[prefix] + 1).padStart(4, '0')}`;
}

export interface DossierTotals {
  dette: number;
  frais: number;
  fraisRegles: number;
  facturesEnAttente: number;
  totalARecouvrer: number;
  jours: number;
  nonRefactures: number;
}

export function dossierTotals(data: FinancesData, dossier: Dossier): DossierTotals {
  const echeance = data.echeances.find((item) => item.id === dossier.echeanceId);
  const factureOf = (id: string | null) => data.factures.find((facture) => facture.id === id);
  const frais = sum(dossier.actes.map((acte) => acte.cout));
  const fraisRegles = sum(dossier.actes.filter((acte) => factureOf(acte.factureId)?.statut === 'payee').map((acte) => acte.cout));
  const enAttente = new Set(dossier.actes.map((acte) => acte.factureId).filter((id): id is string => id !== null));
  const facturesEnAttente = sum(
    [...enAttente].map((id) => factureOf(id)).filter((facture) => facture?.statut === 'attente').map((facture) => facture?.montantTtc ?? 0),
  );
  const dette = echeance ? Math.max(0, resteDu(echeance)) : 0;
  return {
    dette,
    frais,
    fraisRegles,
    facturesEnAttente,
    totalARecouvrer: dette + facturesEnAttente,
    jours: daysBetween(dossier.ouvertLe, data.today),
    nonRefactures: sum(dossier.actes.filter((acte) => acte.cout > 0 && acte.factureId === null).map((acte) => acte.cout)),
  };
}

export type StepState = 'done' | 'cur' | 'todo';

export interface DossierStep {
  id: string;
  label: string;
  caption: string;
  state: StepState;
}

export function dossierSteps(dossier: Dossier, solde: boolean, formatDate: (iso: string) => string): DossierStep[] {
  const reached = (kind: Dossier['actes'][number]['kind']) => dossier.actes.filter((acte) => acte.kind === kind).map((acte) => acte.date).sort()[0];
  const dates = [reached('relance'), reached('mise_en_demeure'), reached('commandement')];
  const labels = ['Relance amiable', 'Mise en demeure', 'Commandement de payer', 'Échéancier ou assignation', 'Clôture du dossier'];
  const lastReached = dates.reduce((acc, date, index) => (date ? index : acc), -1);
  const current = solde ? 4 : dossier.plan ? 3 : Math.max(lastReached, 0);
  return labels.map((label, index) => {
    const date = dates[index];
    const state: StepState = index < current || (solde && index === 4) ? 'done' : index === current ? 'cur' : 'todo';
    let caption = date ? formatDate(date) : index === 0 && current === 0 ? 'À envoyer' : '';
    if (index === 3) caption = dossier.plan ? `Proposé le ${formatDate(dossier.plan.propositionLe)}` : dossier.delaiJusquau ? `Après le ${formatDate(dossier.delaiJusquau)}` : 'Selon le dossier';
    if (index === 4) caption = solde ? 'Soldé' : 'Au solde complet';
    return { id: `step-${String(index)}`, label, caption, state };
  });
}

export function instalments(total: number, count: number, firstDate: string): { date: string; montant: number }[] {
  return splitEvenly(total, count).map((montant, index) => ({ date: addMonths(firstDate, index), montant }));
}

export const regularisationSolde = (provisions: number, chargesReelles: number): number => chargesReelles - provisions;

export type Regime = 'foncier_reel' | 'lmnp_reel' | 'micro_foncier' | 'micro_bic';

export const REGIMES: { value: Regime; label: string }[] = [
  { value: 'foncier_reel', label: 'Revenus fonciers, réel' },
  { value: 'lmnp_reel', label: 'LMNP, réel' },
  { value: 'micro_foncier', label: 'Micro-foncier' },
  { value: 'micro_bic', label: 'Micro-BIC' },
];

export interface BilanView {
  lignes: BilanLigne[];
  recettes: number;
  charges: number;
  net: number;
}

export function bilanView(bilan: Bilan, regime: Regime): BilanView {
  const recettes = bilan.lignes.filter((ligne) => ligne.sens === 'recette');
  const totalRecettes = sum(recettes.map((ligne) => ligne.montant));
  const abattement = (pct: number): BilanLigne => ({
    id: `abattement-${String(pct)}`,
    categorie: `Abattement forfaitaire de ${String(pct)} %`,
    detail: 'Remplace les charges réelles',
    sens: 'charge',
    montant: percentOf(totalRecettes, pct),
    justificatifs: 'complet',
    manquants: 0,
  });
  let lignes: BilanLigne[];
  if (regime === 'micro_foncier') lignes = [...recettes, abattement(30)];
  else if (regime === 'micro_bic') lignes = [...recettes, abattement(50)];
  else if (regime === 'lmnp_reel')
    lignes = [
      ...bilan.lignes,
      { id: 'amortissements', categorie: 'Amortissements', detail: 'Bien et mobilier', sens: 'charge', montant: bilan.amortissementsLmnp, justificatifs: 'complet', manquants: 0 },
    ];
  else lignes = bilan.lignes;
  const charges = sum(lignes.filter((ligne) => ligne.sens === 'charge').map((ligne) => ligne.montant));
  return { lignes, recettes: totalRecettes, charges, net: totalRecettes - charges };
}

export function tauxLabel(tauxBp: number): string {
  return `${String(Math.trunc(tauxBp / 100))},${String(tauxBp % 100).padStart(2, '0')} %`;
}

export const pretAvancement = (pret: Pret): number => divRound(100 * (pret.emprunte - pret.restantDu), pret.emprunte);

export function estimateSchedule(pret: Pret, today: string, count = 12): NonNullable<Pret['echeancier']> {
  const lignes: NonNullable<Pret['echeancier']> = [];
  let restant = pret.restantDu;
  for (let index = 1; index <= count && restant > 0; index += 1) {
    const interets = divRound(restant * pret.tauxBp, 12 * 10_000);
    const capital = Math.min(restant, Math.max(0, pret.mensualite - interets));
    restant -= capital;
    lignes.push({ date: addMonths(`${monthOf(today)}-01`, index), mensualite: capital + interets, interets, capital, restant });
  }
  return lignes;
}
