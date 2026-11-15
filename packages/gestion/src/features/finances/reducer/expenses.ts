import type { FinancesCommandInput } from '../commands';
import type { Depense, FinancesData } from '../schemas';
import { fail, find, money, notInFuture } from './context';
import type { Outcome, ReducerContext } from './context';

export function saveExpense(data: FinancesData, ctx: ReducerContext, cmd: FinancesCommandInput<'saveExpense'>): Outcome {
  notInFuture(data, cmd.date, 'La date de la dépense');
  const fields = {
    bien: cmd.bien,
    type: cmd.expenseType,
    date: cmd.date,
    montantTtc: cmd.montantTtc,
    fournisseur: cmd.fournisseur,
    description: cmd.description,
    numeroFacture: cmd.numeroFacture,
    deductible: cmd.deductible,
    recuperable: cmd.recuperable,
    nonComptabilise: cmd.nonComptabilise,
    justificatif: cmd.justificatif,
  };
  let depense: Depense;
  if (cmd.depenseId) {
    depense = find(data.depenses, cmd.depenseId, 'Dépense');
    if (depense.annulee) fail('Une dépense annulée ne peut plus être modifiée.');
    Object.assign(depense, fields);
  } else {
    depense = { id: ctx.id('dep'), ...fields, annulee: false };
    data.depenses.unshift(depense);
  }
  if (cmd.ligneBancaireId) {
    const ligne = find(data.lignesBancaires, cmd.ligneBancaireId, 'Opération bancaire');
    ligne.statut = 'rapprochee';
    ligne.indication = 'Dépense classée';
  }
  const verb = cmd.depenseId ? 'modifiée' : 'enregistrée';
  return { message: `Dépense de ${money(data, depense.montantTtc)} ${verb}.`, href: '/finances', id: depense.id };
}

export function cancelExpense(data: FinancesData, _ctx: ReducerContext, cmd: FinancesCommandInput<'cancelExpense'>): Outcome {
  const depense = find(data.depenses, cmd.depenseId, 'Dépense');
  depense.annulee = true;
  return { message: 'Dépense annulée. Elle n’est plus comptabilisée.' };
}
