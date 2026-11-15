import type { FinancesCommandInput } from '../commands';
import { resteDu } from '../derive';
import type { FinancesData, LigneBancaire } from '../schemas';
import { fail, find } from './context';
import type { Outcome, ReducerContext } from './context';
import { applyPayment } from './ledger';

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

function proposal(data: FinancesData, libelle: string, montant: number): { echeanceId: string | null; indication: string } {
  if (montant < 0) return { echeanceId: null, indication: 'Aucune, dépense à classer' };
  const text = fold(libelle);
  const candidates = data.echeances
    .filter((echeance) => echeance.statut === 'active' && resteDu(echeance) > 0)
    .filter((echeance) => {
      const bail = data.baux.find((entry) => entry.id === echeance.bailId);
      const tokens = fold(bail?.locataire ?? '').split(' ').filter((token) => token.length >= 3);
      return tokens.length > 0 && tokens.every((token) => text.includes(token));
    })
    .sort((a, b) => a.echeance.localeCompare(b.echeance));
  const match = candidates[0];
  if (!match) return { echeanceId: null, indication: 'Aucune correspondance, à vérifier' };
  const bail = data.baux.find((entry) => entry.id === match.bailId);
  return { echeanceId: match.id, indication: `${match.libelle}, ${bail?.unite ?? ''}` };
}

export function importBankLines(data: FinancesData, ctx: ReducerContext, cmd: FinancesCommandInput<'importBankLines'>): Outcome {
  const known = new Set(data.lignesBancaires.map((ligne) => ligne.cle));
  let added = 0;
  for (const ligne of cmd.lignes) {
    const cle = `${ligne.date}|${fold(ligne.libelle)}|${String(ligne.montant)}`;
    if (known.has(cle)) continue;
    known.add(cle);
    const match = proposal(data, ligne.libelle, ligne.montant);
    data.lignesBancaires.unshift({
      id: ctx.id('bnk'),
      date: ligne.date,
      libelle: ligne.libelle,
      compte: cmd.compte,
      montant: ligne.montant,
      statut: 'a_rapprocher',
      echeanceProposeeId: match.echeanceId,
      indication: match.indication,
      cle,
    });
    added += 1;
  }
  const ignored = cmd.lignes.length - added;
  const doublons = ignored > 0 ? ` ${String(ignored)} doublon${ignored > 1 ? 's' : ''} ignoré${ignored > 1 ? 's' : ''}.` : '';
  return { message: `${String(added)} opération${added > 1 ? 's' : ''} importée${added > 1 ? 's' : ''}.${doublons}` };
}

function pending(data: FinancesData, id: string): LigneBancaire {
  const ligne = find(data.lignesBancaires, id, 'Opération bancaire');
  if (ligne.statut !== 'a_rapprocher') fail('Cette opération est déjà traitée.');
  return ligne;
}

export function matchBankLine(data: FinancesData, ctx: ReducerContext, cmd: FinancesCommandInput<'matchBankLine'>): Outcome {
  const ligne = pending(data, cmd.ligneId);
  if (ligne.montant <= 0) fail('Seul un encaissement peut être rapproché d’une échéance.');
  const echeance = find(data.echeances, cmd.echeanceId, 'Échéance');
  const outcome = applyPayment(data, ctx, {
    bailId: echeance.bailId,
    echeanceId: echeance.id,
    montant: ligne.montant,
    date: ligne.date,
    mode: 'virement',
    nature: 'echeance',
    reference: ligne.libelle,
    note: 'Rapprochement bancaire.',
    comptabilise: true,
    mentionQuittance: true,
  });
  ligne.statut = 'rapprochee';
  ligne.echeanceProposeeId = echeance.id;
  return outcome;
}

export function ignoreBankLine(data: FinancesData, _ctx: ReducerContext, cmd: FinancesCommandInput<'ignoreBankLine'>): Outcome {
  pending(data, cmd.ligneId).statut = 'archivee';
  return { message: 'Opération ignorée, déplacée dans les archives.' };
}

export function restoreBankLine(data: FinancesData, _ctx: ReducerContext, cmd: FinancesCommandInput<'restoreBankLine'>): Outcome {
  const ligne = find(data.lignesBancaires, cmd.ligneId, 'Opération bancaire');
  if (ligne.statut !== 'archivee') fail('Seule une opération archivée peut être restaurée.');
  ligne.statut = 'a_rapprocher';
  return { message: 'Opération remise à rapprocher.' };
}

export function splitBankLine(data: FinancesData, ctx: ReducerContext, cmd: FinancesCommandInput<'splitBankLine'>): Outcome {
  const ligne = pending(data, cmd.ligneId);
  const sameSign = Math.sign(cmd.premierePart) === Math.sign(ligne.montant);
  if (!sameSign || Math.abs(cmd.premierePart) >= Math.abs(ligne.montant)) fail('La première part doit être inférieure à l’opération, du même sens.');
  const reste = ligne.montant - cmd.premierePart;
  data.lignesBancaires.unshift({ ...ligne, id: ctx.id('bnk'), montant: reste, cle: `${ligne.cle}#b`, libelle: `${ligne.libelle} (2/2)`, echeanceProposeeId: null, indication: 'Part à classer' });
  ligne.montant = cmd.premierePart;
  ligne.cle = `${ligne.cle}#a`;
  ligne.libelle = `${ligne.libelle} (1/2)`;
  return { message: 'Opération divisée en deux parts.' };
}

export function toggleAutomation(data: FinancesData, _ctx: ReducerContext, cmd: FinancesCommandInput<'toggleAutomation'>): Outcome {
  find(data.automatisations, cmd.automatisationId, 'Automatisation').active = cmd.active;
  return { message: cmd.active ? 'Automatisation activée.' : 'Automatisation désactivée.' };
}
