import type { FinancesCommand } from '../commands';
import type { FinancesData } from '../schemas';
import { ignoreBankLine, importBankLines, matchBankLine, restoreBankLine, splitBankLine, toggleAutomation } from './bank';
import type { Outcome, ReducerContext } from './context';
import { cancelExpense, saveExpense } from './expenses';
import {
  attachJustificatif,
  cancelEcheance,
  carryCredit,
  creditInvoice,
  createInvoice,
  duplicateEcheance,
  markInvoicePaid,
  markUncollectible,
  recordPayment,
  sendInvoice,
  sendReceipt,
  sendReminders,
  shiftEcheances,
  updateEcheance,
} from './ledger';
import { deletePret, importEcheancier, prepayPret, savePret, saveRegularisation, setPretStatut } from './patrimoine';
import { addCreances, addDiligence, billDossierFees, openDossier, proposePlan, removeCreance, sendRelance } from './recouvrement';
import { generateLiasse, resendTransmission, revokeTransmission, transmitLiasse } from './transmission';

export { FinancesCommandError } from './context';
export type { Outcome, ReducerContext } from './context';

export function reduceCommand(state: FinancesData, ctx: ReducerContext, command: FinancesCommand): { data: FinancesData; outcome: Outcome } {
  const data = structuredClone(state);
  const outcome = run(data, ctx, command);
  return { data, outcome };
}

function run(data: FinancesData, ctx: ReducerContext, cmd: FinancesCommand): Outcome {
  switch (cmd.type) {
    case 'recordPayment': return recordPayment(data, ctx, cmd);
    case 'sendReminders': return sendReminders(data, ctx, cmd);
    case 'sendRelance': return sendRelance(data, ctx, cmd);
    case 'markUncollectible': return markUncollectible(data, ctx, cmd);
    case 'updateEcheance': return updateEcheance(data, ctx, cmd);
    case 'shiftEcheances': return shiftEcheances(data, ctx, cmd);
    case 'duplicateEcheance': return duplicateEcheance(data, ctx, cmd);
    case 'cancelEcheance': return cancelEcheance(data, ctx, cmd);
    case 'attachJustificatif': return attachJustificatif(data, ctx, cmd);
    case 'carryCredit': return carryCredit(data, ctx, cmd);
    case 'saveExpense': return saveExpense(data, ctx, cmd);
    case 'cancelExpense': return cancelExpense(data, ctx, cmd);
    case 'createInvoice': return createInvoice(data, ctx, cmd);
    case 'creditInvoice': return creditInvoice(data, ctx, cmd);
    case 'markInvoicePaid': return markInvoicePaid(data, ctx, cmd);
    case 'sendInvoice': return sendInvoice(data, ctx, cmd);
    case 'sendReceipt': return sendReceipt(data, ctx, cmd);
    case 'openDossier': return openDossier(data, ctx, cmd);
    case 'addCreances': return addCreances(data, ctx, cmd);
    case 'removeCreance': return removeCreance(data, ctx, cmd);
    case 'generateLiasse': return generateLiasse(data, ctx, cmd);
    case 'transmitLiasse': return transmitLiasse(data, ctx, cmd);
    case 'revokeTransmission': return revokeTransmission(data, ctx, cmd);
    case 'resendTransmission': return resendTransmission(data, ctx, cmd);
    case 'addDiligence': return addDiligence(data, ctx, cmd);
    case 'billDossierFees': return billDossierFees(data, ctx, cmd);
    case 'proposePlan': return proposePlan(data, ctx, cmd);
    case 'saveRegularisation': return saveRegularisation(data, ctx, cmd);
    case 'savePret': return savePret(data, ctx, cmd);
    case 'prepayPret': return prepayPret(data, ctx, cmd);
    case 'setPretStatut': return setPretStatut(data, ctx, cmd);
    case 'deletePret': return deletePret(data, ctx, cmd);
    case 'importEcheancier': return importEcheancier(data, ctx, cmd);
    case 'importBankLines': return importBankLines(data, ctx, cmd);
    case 'matchBankLine': return matchBankLine(data, ctx, cmd);
    case 'ignoreBankLine': return ignoreBankLine(data, ctx, cmd);
    case 'restoreBankLine': return restoreBankLine(data, ctx, cmd);
    case 'splitBankLine': return splitBankLine(data, ctx, cmd);
    case 'toggleAutomation': return toggleAutomation(data, ctx, cmd);
  }
}
