import type { FinancesCommandInput } from '../commands';
import { addDays } from '../dates';
import { instalments, resteDu, slugify } from '../derive';
import type { Dossier, FinancesData } from '../schemas';
import { fail, find } from './context';
import type { Outcome, ReducerContext } from './context';
import { createInvoiceRecord } from './ledger';

function openDossierFor(data: FinancesData, echeanceId: string): Dossier {
  const echeance = find(data.echeances, echeanceId, 'Échéance');
  const existing = data.dossiers.find((dossier) => dossier.echeanceId === echeanceId);
  if (existing) return existing;
  if (echeance.statut !== 'active' || resteDu(echeance) <= 0) fail('Seule une créance impayée peut faire l’objet d’un dossier.');
  data.sequences.DOS += 1;
  const numero = `RC-${data.today.slice(0, 4)}-${String(data.sequences.DOS).padStart(4, '0')}`;
  const dossier: Dossier = { id: `dos-${slugify(numero)}`, numero, echeanceId, ouvertLe: data.today, delaiJusquau: null, actes: [], plan: null };
  data.dossiers.push(dossier);
  return dossier;
}

export function openDossier(data: FinancesData, ctx: ReducerContext, cmd: FinancesCommandInput<'openDossier'>): Outcome {
  const dossier = openDossierFor(data, cmd.echeanceId);
  return { message: `Dossier ${dossier.numero} ouvert.`, id: dossier.id };
}

export function addDiligence(data: FinancesData, ctx: ReducerContext, cmd: FinancesCommandInput<'addDiligence'>): Outcome {
  const dossier = find(data.dossiers, cmd.dossierId, 'Dossier');
  if (cmd.date > data.today) fail('La date de l’acte ne peut pas être dans le futur.');
  if (cmd.date < dossier.ouvertLe) fail('La date de l’acte précède l’ouverture du dossier.');
  dossier.actes.push({ id: ctx.id('acte'), date: cmd.date, kind: cmd.kind, libelle: cmd.libelle, intervenant: cmd.intervenant, cout: cmd.cout, factureId: null });
  if (cmd.kind === 'commandement' && dossier.delaiJusquau === null) dossier.delaiJusquau = addDays(cmd.date, 9);
  if (cmd.kind === 'relance' || cmd.kind === 'mise_en_demeure') {
    data.relances.push({
      id: ctx.id('rel'),
      echeanceId: dossier.echeanceId,
      date: cmd.date,
      canal: cmd.kind === 'mise_en_demeure' ? 'recommande' : 'courrier',
      amiable: cmd.kind === 'relance',
    });
  }
  return { message: 'Diligence ajoutée au carnet.' };
}

export function billDossierFees(data: FinancesData, ctx: ReducerContext, cmd: FinancesCommandInput<'billDossierFees'>): Outcome {
  const dossier = find(data.dossiers, cmd.dossierId, 'Dossier');
  const echeance = find(data.echeances, dossier.echeanceId, 'Échéance');
  const bail = find(data.baux, echeance.bailId, 'Bail');
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
  const echeance = find(data.echeances, cmd.echeanceId, 'Échéance');
  const reste = resteDu(echeance);
  if (reste < cmd.count) fail('Le reste dû est trop faible pour être échelonné.');
  const dossier = openDossierFor(data, cmd.echeanceId);
  dossier.plan = { lignes: instalments(reste, cmd.count, cmd.premiere), propositionLe: data.today };
  return { message: `Échéancier en ${String(cmd.count)} versements proposé.`, id: dossier.id };
}
