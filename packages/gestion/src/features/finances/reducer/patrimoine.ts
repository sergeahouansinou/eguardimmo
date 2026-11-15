import type { FinancesCommandInput } from '../commands';
import { regularisationSolde, slugify } from '../derive';
import type { FinancesData, Pret, Regularisation } from '../schemas';
import { fail, find, money } from './context';
import type { Outcome, ReducerContext } from './context';
import { createInvoiceRecord } from './ledger';
import { addDays } from '../dates';

export function saveRegularisation(data: FinancesData, ctx: ReducerContext, cmd: FinancesCommandInput<'saveRegularisation'>): Outcome {
  const bail = find(data.baux, cmd.bailId, 'Bail');
  if (cmd.fin <= cmd.debut) fail('La fin de période doit suivre le début.');
  let regularisation: Regularisation;
  if (cmd.regularisationId) {
    regularisation = find(data.regularisations, cmd.regularisationId, 'Décompte');
    if (regularisation.statut === 'emise') fail('Un décompte émis ne se modifie pas.');
    Object.assign(regularisation, { bailId: cmd.bailId, debut: cmd.debut, fin: cmd.fin, provisions: cmd.provisions, chargesReelles: cmd.chargesReelles, justificatifs: cmd.justificatifs });
  } else {
    regularisation = { id: ctx.id('reg'), bailId: cmd.bailId, debut: cmd.debut, fin: cmd.fin, provisions: cmd.provisions, chargesReelles: cmd.chargesReelles, justificatifs: cmd.justificatifs, statut: 'brouillon', factureId: null };
    data.regularisations.unshift(regularisation);
  }
  if (!cmd.emettre) return { message: 'Brouillon enregistré.', id: regularisation.id };
  regularisation.statut = 'emise';
  const solde = regularisationSolde(cmd.provisions, cmd.chargesReelles);
  if (solde > 0) {
    const facture = createInvoiceRecord(data, ctx, {
      locataireId: bail.locataireId,
      date: data.today,
      objet: `Régularisation des charges ${cmd.fin.slice(0, 4)}`,
      montantHt: solde,
      tvaPct: 0,
      echeance: addDays(data.today, 30),
    });
    regularisation.factureId = facture.id;
    return { message: `Décompte émis : ${bail.locataire} doit ${money(data, solde)} (facture ${facture.numero}).`, href: `/finances/factures/${facture.id}`, id: regularisation.id };
  }
  const detail = solde < 0 ? `${money(data, -solde)} à rembourser au locataire` : 'aucun solde';
  return { message: `Décompte émis : ${detail}.`, id: regularisation.id };
}

export function savePret(data: FinancesData, ctx: ReducerContext, cmd: FinancesCommandInput<'savePret'>): Outcome {
  if (cmd.restantDu > cmd.emprunte) fail('Le capital restant dû dépasse le montant emprunté.');
  const fields = { bien: cmd.bien, banque: cmd.banque, emprunte: cmd.emprunte, tauxBp: cmd.tauxBp, fin: cmd.fin, mensualite: cmd.mensualite, restantDu: cmd.restantDu, interetsAnnee: cmd.interetsAnnee };
  let pret: Pret;
  if (cmd.pretId) {
    pret = find(data.prets, cmd.pretId, 'Prêt');
    Object.assign(pret, fields, { echeancier: null });
  } else {
    pret = { id: `pret-${slugify(cmd.banque)}-${ctx.id('n')}`, ...fields, statut: cmd.restantDu === 0 ? 'rembourse' : 'en_cours', supprime: false, echeancier: null };
    data.prets.push(pret);
  }
  return { message: cmd.pretId ? 'Prêt modifié.' : `Prêt ${pret.banque} ajouté.`, id: pret.id };
}

export function prepayPret(data: FinancesData, _ctx: ReducerContext, cmd: FinancesCommandInput<'prepayPret'>): Outcome {
  const pret = find(data.prets, cmd.pretId, 'Prêt');
  if (pret.statut !== 'en_cours') fail('Ce prêt n’est plus en cours.');
  if (cmd.montant > pret.restantDu) fail('Le remboursement dépasse le capital restant dû.');
  pret.restantDu -= cmd.montant;
  pret.echeancier = null;
  if (pret.restantDu === 0) pret.statut = 'rembourse';
  return { message: `Remboursement anticipé de ${money(data, cmd.montant)} enregistré.${pret.statut === 'rembourse' ? ' Le prêt est soldé.' : ''}` };
}

export function setPretStatut(data: FinancesData, _ctx: ReducerContext, cmd: FinancesCommandInput<'setPretStatut'>): Outcome {
  const pret = find(data.prets, cmd.pretId, 'Prêt');
  if (cmd.statut === 'en_cours' && pret.restantDu === 0) fail('Un prêt soldé ne peut pas revenir en cours.');
  pret.statut = cmd.statut;
  return { message: cmd.statut === 'archive' ? 'Prêt archivé.' : 'Prêt remis en cours.' };
}

export function deletePret(data: FinancesData, _ctx: ReducerContext, cmd: FinancesCommandInput<'deletePret'>): Outcome {
  find(data.prets, cmd.pretId, 'Prêt').supprime = true;
  return { message: 'Prêt supprimé de la liste.' };
}

export function importEcheancier(data: FinancesData, _ctx: ReducerContext, cmd: FinancesCommandInput<'importEcheancier'>): Outcome {
  const pret = find(data.prets, cmd.pretId, 'Prêt');
  pret.echeancier = [...cmd.lignes].sort((a, b) => a.date.localeCompare(b.date));
  return { message: `Échéancier importé : ${String(cmd.lignes.length)} échéances.` };
}
