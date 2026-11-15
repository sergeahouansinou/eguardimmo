import type { FinancesCommandInput } from '../commands';
import { addDays } from '../dates';
import { bailOf, creancesActives, dossierTotals, instalments, resteDu, resteFacture, slugify } from '../derive';
import type { Creance, Dossier, FinancesData } from '../schemas';
import { creanceKey, dossierOfCreance, firstEcheanceId, openDossierOfBail } from '../recouvrement/creances';
import type { CreanceRef } from '../recouvrement/creances';
import { fail, find } from './context';
import type { Outcome, ReducerContext } from './context';
import { createInvoiceRecord } from './ledger';

function checkedCreance(data: FinancesData, bailId: string, ref: CreanceRef): { libelle: string; reste: number } {
  if (ref.kind === 'echeance') {
    const echeance = find(data.echeances, ref.refId, 'Échéance');
    if (echeance.bailId !== bailId) fail('Cette échéance appartient à un autre bail.');
    if (echeance.statut !== 'active' || resteDu(echeance) <= 0) fail('Seule une créance impayée peut faire l’objet d’un dossier.');
    return { libelle: echeance.libelle, reste: resteDu(echeance) };
  }
  const facture = find(data.factures, ref.refId, 'Facture');
  if (facture.bailId !== bailId) fail('Cette facture appartient à un autre bail.');
  if (facture.dossierId !== null) fail('Les frais de recouvrement refacturés ne sont pas une créance du dossier.');
  const reste = resteFacture(data, facture);
  if (reste <= 0) fail('Seule une créance impayée peut faire l’objet d’un dossier.');
  return { libelle: `Facture ${facture.numero}, ${facture.objet}`, reste };
}

function creanceLines(data: FinancesData, ctx: ReducerContext, bailId: string, refs: readonly CreanceRef[]): Creance[] {
  const seen = new Set<string>();
  return refs.map((ref) => {
    const key = creanceKey(ref);
    if (seen.has(key)) fail('Une créance ne peut être choisie qu’une fois.');
    seen.add(key);
    const { libelle, reste } = checkedCreance(data, bailId, ref);
    const holder = dossierOfCreance(data, ref);
    if (holder) fail(`« ${libelle} » est déjà dans le dossier ${holder.numero}.`);
    return { id: ctx.id('cre'), kind: ref.kind, refId: ref.refId, libelle, montantInitial: reste, inclusLe: data.today, retireLe: null };
  });
}

function createDossier(data: FinancesData, ctx: ReducerContext, bailId: string, refs: readonly CreanceRef[]): Dossier {
  const bail = bailOf(data, bailId);
  if (!bail) fail('Bail introuvable.');
  const existing = openDossierOfBail(data, bailId);
  if (existing) fail(`Un dossier est déjà ouvert pour ce bail (${existing.numero}) : ajoutez-y les créances.`);
  const creances = creanceLines(data, ctx, bailId, refs);
  data.sequences.DOS += 1;
  const numero = `RC-${data.today.slice(0, 4)}-${String(data.sequences.DOS).padStart(4, '0')}`;
  const dossier: Dossier = { id: `dos-${slugify(numero)}`, numero, bailId, ouvertLe: data.today, delaiJusquau: null, creances, actes: [], plan: null, liasses: [], transmissions: [] };
  data.dossiers.push(dossier);
  return dossier;
}

function ensureDossierFor(data: FinancesData, ctx: ReducerContext, echeanceId: string): Dossier {
  const echeance = find(data.echeances, echeanceId, 'Échéance');
  const ref: CreanceRef = { kind: 'echeance', refId: echeanceId };
  const holder = dossierOfCreance(data, ref);
  if (holder) return holder;
  checkedCreance(data, echeance.bailId, ref);
  const sameBail = openDossierOfBail(data, echeance.bailId);
  if (!sameBail) return createDossier(data, ctx, echeance.bailId, [ref]);
  sameBail.creances.push(...creanceLines(data, ctx, echeance.bailId, [ref]));
  return sameBail;
}

export function openDossier(data: FinancesData, ctx: ReducerContext, cmd: FinancesCommandInput<'openDossier'>): Outcome {
  const dossier = createDossier(data, ctx, cmd.bailId, cmd.creances);
  return { message: `Dossier ${dossier.numero} ouvert.`, id: dossier.id, href: `/finances/recouvrement/${dossier.id}` };
}

export function addCreances(data: FinancesData, ctx: ReducerContext, cmd: FinancesCommandInput<'addCreances'>): Outcome {
  const dossier = find(data.dossiers, cmd.dossierId, 'Dossier');
  dossier.creances.push(...creanceLines(data, ctx, dossier.bailId, cmd.creances));
  const count = cmd.creances.length;
  return { message: `${String(count)} créance${count > 1 ? 's' : ''} ajoutée${count > 1 ? 's' : ''} au dossier ${dossier.numero}.`, id: dossier.id };
}

export function removeCreance(data: FinancesData, ctx: ReducerContext, cmd: FinancesCommandInput<'removeCreance'>): Outcome {
  const dossier = find(data.dossiers, cmd.dossierId, 'Dossier');
  const creance = find(dossier.creances, cmd.creanceId, 'Créance');
  if (creance.retireLe !== null) fail('Cette créance est déjà retirée du dossier.');
  if (creancesActives(dossier).length === 1) fail('Un dossier garde au moins une créance.');
  creance.retireLe = data.today;
  return { message: `Créance retirée du dossier ${dossier.numero}, l’historique est conservé.`, id: dossier.id };
}

export function addDiligence(data: FinancesData, ctx: ReducerContext, cmd: FinancesCommandInput<'addDiligence'>): Outcome {
  const dossier = find(data.dossiers, cmd.dossierId, 'Dossier');
  if (cmd.date > data.today) fail('La date de l’acte ne peut pas être dans le futur.');
  if (cmd.date < dossier.ouvertLe) fail('La date de l’acte précède l’ouverture du dossier.');
  dossier.actes.push({ id: ctx.id('acte'), date: cmd.date, kind: cmd.kind, libelle: cmd.libelle, intervenant: cmd.intervenant, cout: cmd.cout, factureId: null });
  if (cmd.kind === 'commandement' && dossier.delaiJusquau === null) dossier.delaiJusquau = addDays(cmd.date, 9);
  const echeanceId = firstEcheanceId(dossier);
  if (echeanceId !== null && (cmd.kind === 'relance' || cmd.kind === 'mise_en_demeure')) {
    data.relances.push({
      id: ctx.id('rel'),
      echeanceId,
      date: cmd.date,
      canal: cmd.kind === 'mise_en_demeure' ? 'recommande' : 'courrier',
      amiable: cmd.kind === 'relance',
    });
  }
  return { message: 'Diligence ajoutée au carnet.' };
}

export function billDossierFees(data: FinancesData, ctx: ReducerContext, cmd: FinancesCommandInput<'billDossierFees'>): Outcome {
  const dossier = find(data.dossiers, cmd.dossierId, 'Dossier');
  const bail = find(data.baux, dossier.bailId, 'Bail');
  const unbilled = dossier.actes.map((acte, index) => ({ acte, index })).filter(({ acte }) => acte.cout > 0 && acte.factureId === null);
  if (unbilled.length === 0) fail('Aucun frais à refacturer.');
  const lignes = unbilled.map(({ acte, index }) => ({
    designation: `${acte.libelle}, ${acte.intervenant}`,
    reference: `Acte n° ${String(index + 1)}`,
    quantite: 1,
    prixUnitaire: acte.cout,
    montant: acte.cout,
  }));
  const facture = createInvoiceRecord(data, ctx, {
    locataireId: bail.locataireId,
    date: data.today,
    objet: 'Frais de recouvrement',
    montantHt: lignes.reduce((total, ligne) => total + ligne.montant, 0),
    tvaPct: 0,
    echeance: cmd.echeance,
    dossierId: dossier.id,
    lignes,
  });
  for (const { acte } of unbilled) acte.factureId = facture.id;
  return { message: `Facture ${facture.numero} émise pour les frais du dossier.`, id: facture.id };
}

export function proposePlan(data: FinancesData, ctx: ReducerContext, cmd: FinancesCommandInput<'proposePlan'>): Outcome {
  if (cmd.premiere < data.today) fail('La première échéance ne peut pas être passée.');
  let dossier: Dossier;
  if (cmd.dossierId !== null) dossier = find(data.dossiers, cmd.dossierId, 'Dossier');
  else if (cmd.echeanceId !== null) dossier = ensureDossierFor(data, ctx, cmd.echeanceId);
  else return fail('Précisez le dossier ou l’échéance à étaler.');
  const reste = dossierTotals(data, dossier).dette;
  if (reste < cmd.count) fail('Le reste dû est trop faible pour être échelonné.');
  dossier.plan = { lignes: instalments(reste, cmd.count, cmd.premiere), propositionLe: data.today };
  return { message: `Échéancier en ${String(cmd.count)} versements proposé.`, id: dossier.id };
}

const RELANCE_COUTS = { email: 0, courrier: 1500, recommande: 620 } as const;
const RELANCE_CANAUX = { email: 'par e-mail', courrier: 'par courrier', recommande: 'en recommandé AR' } as const;
const RELANCE_LIBELLES = { amiable: 'Relance amiable', seconde: 'Deuxième relance', mise_en_demeure: 'Mise en demeure' } as const;

export function sendRelance(data: FinancesData, ctx: ReducerContext, cmd: FinancesCommandInput<'sendRelance'>): Outcome {
  const echeance = find(data.echeances, cmd.echeanceId, 'Échéance');
  if (echeance.statut !== 'active' || resteDu(echeance) <= 0) fail('Seule une échéance impayée peut être relancée.');
  if (cmd.niveau === 'mise_en_demeure' && cmd.canal === 'email') fail('Une mise en demeure part par courrier ou en recommandé.');
  const dossier = ensureDossierFor(data, ctx, cmd.echeanceId);
  const kind = cmd.niveau === 'mise_en_demeure' ? 'mise_en_demeure' : 'relance';
  const suffix = cmd.joindreGrandLivre ? ', grand livre joint' : '';
  dossier.actes.push({
    id: ctx.id('acte'),
    date: data.today,
    kind,
    libelle: `${cmd.modele} ${RELANCE_CANAUX[cmd.canal]}${suffix}`,
    intervenant: data.workspace.nom,
    cout: RELANCE_COUTS[cmd.canal],
    factureId: null,
  });
  data.relances.push({ id: ctx.id('rel'), echeanceId: cmd.echeanceId, date: data.today, canal: cmd.canal, amiable: kind === 'relance' && cmd.canal !== 'recommande' });
  return { message: `${RELANCE_LIBELLES[cmd.niveau]} envoyée et consignée au dossier ${dossier.numero}.`, id: dossier.id };
}
