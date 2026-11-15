import type { FinancesCommandInput } from '../commands';
import { addMonths } from '../dates';
import { resteDu, slugify } from '../derive';
import type { Facture, FinancesData, Paiement } from '../schemas';
import { fail, find, money, notInFuture } from './context';
import type { Outcome, ReducerContext } from './context';

export interface PaymentInput {
  bailId: string;
  echeanceId: string | null;
  montant: number;
  date: string;
  mode: Paiement['mode'];
  nature: Paiement['nature'];
  reference: string;
  note: string;
  comptabilise: boolean;
  mentionQuittance: boolean;
}

const NATURE_LABELS: Record<Paiement['nature'], string> = {
  echeance: 'Paiement d’échéance',
  acompte_loyer: 'Acompte sur loyer',
  acompte_depot: 'Acompte sur dépôt de garantie',
  autre: 'Encaissement',
};

export function applyPayment(data: FinancesData, ctx: ReducerContext, input: PaymentInput): Outcome {
  const bail = find(data.baux, input.bailId, 'Bail');
  notInFuture(data, input.date, 'La date du paiement');
  const echeance = input.echeanceId ? find(data.echeances, input.echeanceId, 'Échéance') : null;
  if (echeance && echeance.bailId !== bail.id) fail('Cette échéance n’appartient pas à ce bail.');
  if (echeance && echeance.statut !== 'active') fail('Cette échéance n’est plus appelée.');
  if (echeance && input.comptabilise) echeance.paye += input.montant;
  const resteApres = echeance ? resteDu(echeance) : 0;
  const paiementId = ctx.id('pay');
  const paiement: Paiement = {
    id: paiementId,
    bailId: bail.id,
    echeanceId: echeance?.id ?? null,
    date: input.date,
    montant: input.montant,
    mode: input.mode,
    nature: input.nature,
    reference: input.reference,
    note: input.note,
    comptabilise: input.comptabilise,
    mentionQuittance: input.mentionQuittance,
    recuId: null,
    libelle: echeance ? echeance.libelle : NATURE_LABELS[input.nature],
  };
  const needsRecu = input.comptabilise && (input.nature === 'acompte_depot' || input.nature === 'autre' || resteApres > 0);
  let recuHref: string | undefined;
  if (needsRecu) {
    data.sequences.RC += 1;
    const numero = `RC-${data.today.slice(0, 4)}-${String(data.sequences.RC).padStart(4, '0')}`;
    const recuId = slugify(numero);
    data.recus.unshift({
      id: recuId,
      numero,
      date: input.date,
      paiementId,
      bailId: bail.id,
      echeanceId: echeance?.id ?? null,
      nature: input.nature,
      montant: input.montant,
      mode: input.mode,
      reference: input.reference,
      appele: echeance?.montant ?? 0,
      recuSurEcheance: echeance?.paye ?? input.montant,
      resteDu: Math.max(0, resteApres),
      envoyeLe: null,
      empreinte: '',
      scelleLe: ctx.now,
    });
    paiement.recuId = recuId;
    recuHref = `/finances/recus/${recuId}`;
  }
  data.paiements.unshift(paiement);
  const detail = resteApres > 0 ? ` Il reste ${money(data, resteApres)} à régler.` : '';
  const message = input.comptabilise
    ? `Paiement de ${money(data, input.montant)} enregistré.${detail}`
    : `Montant de ${money(data, input.montant)} enregistré sans être comptabilisé.`;
  return { message, href: recuHref ?? '/finances', id: paiementId };
}

export function recordPayment(data: FinancesData, ctx: ReducerContext, cmd: FinancesCommandInput<'recordPayment'>): Outcome {
  const outcome = applyPayment(data, ctx, cmd);
  const recu = data.recus.find((entry) => entry.paiementId === outcome.id);
  if (recu && cmd.envoyerRecu) recu.envoyeLe = data.today;
  return outcome;
}

export function sendReminders(data: FinancesData, ctx: ReducerContext, cmd: FinancesCommandInput<'sendReminders'>): Outcome {
  for (const id of cmd.echeanceIds) {
    const echeance = find(data.echeances, id, 'Échéance');
    if (echeance.statut !== 'active' || resteDu(echeance) <= 0) fail('Seule une échéance impayée peut être relancée.');
    data.relances.push({ id: ctx.id('rel'), echeanceId: id, date: data.today, canal: cmd.canal, amiable: true });
  }
  const count = cmd.echeanceIds.length;
  return { message: count > 1 ? `${String(count)} relances envoyées.` : 'Relance envoyée et tracée.' };
}

export function markUncollectible(data: FinancesData, _ctx: ReducerContext, cmd: FinancesCommandInput<'markUncollectible'>): Outcome {
  const echeance = find(data.echeances, cmd.echeanceId, 'Échéance');
  if (resteDu(echeance) <= 0) fail('Cette échéance n’a pas de reste dû.');
  echeance.statut = 'irrecouvrable';
  return { message: 'La créance est passée en irrécouvrable. Elle reste consultable dans le grand livre.' };
}

export function updateEcheance(data: FinancesData, _ctx: ReducerContext, cmd: FinancesCommandInput<'updateEcheance'>): Outcome {
  const echeance = find(data.echeances, cmd.echeanceId, 'Échéance');
  if (echeance.statut !== 'active') fail('Seule une échéance appelée peut être modifiée.');
  echeance.libelle = cmd.libelle;
  echeance.montant = cmd.montant;
  echeance.echeance = cmd.echeance;
  return { message: 'Échéance modifiée.' };
}

export function shiftEcheances(data: FinancesData, _ctx: ReducerContext, cmd: FinancesCommandInput<'shiftEcheances'>): Outcome {
  const targets = cmd.echeanceIds.map((id) => find(data.echeances, id, 'Échéance'));
  for (const echeance of targets) echeance.echeance = cmd.echeance;
  return { message: targets.length > 1 ? `${String(targets.length)} échéances modifiées.` : 'Échéance modifiée.' };
}

export function duplicateEcheance(data: FinancesData, ctx: ReducerContext, cmd: FinancesCommandInput<'duplicateEcheance'>): Outcome {
  const source = find(data.echeances, cmd.echeanceId, 'Échéance');
  const id = ctx.id('ech');
  data.echeances.push({ ...source, id, libelle: `${source.libelle} (copie)`, echeance: addMonths(source.echeance, 1), paye: 0, statut: 'active', justificatifs: [] });
  return { message: 'Échéance dupliquée au mois suivant.', id };
}

export function cancelEcheance(data: FinancesData, _ctx: ReducerContext, cmd: FinancesCommandInput<'cancelEcheance'>): Outcome {
  const echeance = find(data.echeances, cmd.echeanceId, 'Échéance');
  if (echeance.paye > 0) fail('Des paiements sont rattachés à cet avis : il ne peut pas être annulé.');
  echeance.statut = 'annulee';
  return { message: 'Avis d’échéance annulé. Il reste consultable.' };
}

export function attachJustificatif(data: FinancesData, _ctx: ReducerContext, cmd: FinancesCommandInput<'attachJustificatif'>): Outcome {
  const echeance = find(data.echeances, cmd.echeanceId, 'Échéance');
  if (!echeance.justificatifs.includes(cmd.fileName)) echeance.justificatifs.push(cmd.fileName);
  return { message: `Justificatif « ${cmd.fileName} » joint.` };
}

export function carryCredit(data: FinancesData, _ctx: ReducerContext, cmd: FinancesCommandInput<'carryCredit'>): Outcome {
  const source = find(data.echeances, cmd.echeanceId, 'Échéance');
  const credit = -resteDu(source);
  if (credit <= 0) fail('Cette échéance n’a pas de trop-perçu.');
  const next = data.echeances
    .filter((echeance) => echeance.bailId === source.bailId && echeance.statut === 'active' && echeance.echeance > source.echeance && resteDu(echeance) > 0)
    .sort((a, b) => a.echeance.localeCompare(b.echeance))[0];
  if (!next) return fail('Aucune échéance suivante sur ce bail : le crédit ne peut pas être reporté.');
  source.paye -= credit;
  next.paye += credit;
  return { message: `Crédit de ${money(data, credit)} reporté sur « ${next.libelle} ».` };
}

export function createInvoiceRecord(
  data: FinancesData,
  ctx: ReducerContext,
  input: { locataireId: string; date: string; objet: string; montantHt: number; tvaPct: number; echeance: string | null; dossierId?: string; lignes?: Facture['lignes'] },
): Facture {
  const bail = data.baux.filter((entry) => entry.locataireId === input.locataireId).at(-1);
  if (!bail) return fail('Destinataire introuvable.');
  notInFuture(data, input.date, 'La date d’émission');
  if (input.echeance && input.echeance < input.date) fail('L’échéance de paiement précède la date d’émission.');
  const tva = Math.trunc((input.montantHt * input.tvaPct + 50) / 100);
  data.sequences.FA += 1;
  const numero = `FA-${data.today.slice(0, 4)}-${String(data.sequences.FA).padStart(4, '0')}`;
  const facture: Facture = {
    id: slugify(numero),
    numero,
    type: 'facture',
    date: input.date,
    locataireId: bail.locataireId,
    destinataire: bail.locataire,
    objet: input.objet,
    montantHt: input.montantHt,
    tvaPct: input.tvaPct,
    montantTtc: input.montantHt + tva,
    echeance: input.echeance,
    statut: 'attente',
    payeLe: null,
    envoyeLe: null,
    lignes: input.lignes ?? [{ designation: input.objet, reference: '', quantite: 1, prixUnitaire: input.montantHt, montant: input.montantHt }],
    bailId: bail.id,
    dossierId: input.dossierId ?? null,
    factureOrigineId: null,
    avoirId: null,
    empreinte: '',
    scelleLe: ctx.now,
  };
  data.factures.unshift(facture);
  return facture;
}

export function createInvoice(data: FinancesData, ctx: ReducerContext, cmd: FinancesCommandInput<'createInvoice'>): Outcome {
  const facture = createInvoiceRecord(data, ctx, cmd);
  return { message: `Facture ${facture.numero} émise, ${money(data, facture.montantTtc)} à payer.`, href: `/finances/factures/${facture.id}`, id: facture.id };
}

export function creditInvoice(data: FinancesData, ctx: ReducerContext, cmd: FinancesCommandInput<'creditInvoice'>): Outcome {
  const origine = find(data.factures, cmd.factureId, 'Facture');
  if (origine.type !== 'facture') fail('Un avoir ne peut pas être annulé.');
  if (origine.avoirId) fail('Cette facture a déjà fait l’objet d’un avoir.');
  data.sequences.AV += 1;
  const numero = `AV-${data.today.slice(0, 4)}-${String(data.sequences.AV).padStart(4, '0')}`;
  const avoir: Facture = {
    ...origine,
    id: slugify(numero),
    numero,
    type: 'avoir',
    date: data.today,
    objet: `Avoir sur ${origine.numero}`,
    montantHt: -origine.montantHt,
    montantTtc: -origine.montantTtc,
    lignes: origine.lignes.map((ligne) => ({ ...ligne, prixUnitaire: -ligne.prixUnitaire, montant: -ligne.montant })),
    echeance: null,
    statut: 'avoir',
    payeLe: null,
    envoyeLe: null,
    dossierId: null,
    factureOrigineId: origine.id,
    avoirId: null,
    empreinte: '',
    scelleLe: ctx.now,
  };
  origine.avoirId = avoir.id;
  data.factures.unshift(avoir);
  return { message: `Avoir ${numero} émis sur ${origine.numero}.`, href: `/finances/factures/${avoir.id}`, id: avoir.id };
}

export function markInvoicePaid(data: FinancesData, _ctx: ReducerContext, cmd: FinancesCommandInput<'markInvoicePaid'>): Outcome {
  const facture = find(data.factures, cmd.factureId, 'Facture');
  if (facture.type !== 'facture' || facture.statut !== 'attente') fail('Seule une facture en attente peut être réglée.');
  notInFuture(data, cmd.date, 'La date du paiement');
  facture.statut = 'payee';
  facture.payeLe = cmd.date;
  return { message: `Facture ${facture.numero} marquée comme payée.` };
}

export function sendInvoice(data: FinancesData, _ctx: ReducerContext, cmd: FinancesCommandInput<'sendInvoice'>): Outcome {
  const facture = find(data.factures, cmd.factureId, 'Facture');
  facture.envoyeLe = data.today;
  return { message: `Facture ${facture.numero} envoyée à ${facture.destinataire}.` };
}

export function sendReceipt(data: FinancesData, _ctx: ReducerContext, cmd: FinancesCommandInput<'sendReceipt'>): Outcome {
  const recu = find(data.recus, cmd.recuId, 'Reçu');
  recu.envoyeLe = data.today;
  return { message: `Reçu ${recu.numero} renvoyé au locataire.` };
}
