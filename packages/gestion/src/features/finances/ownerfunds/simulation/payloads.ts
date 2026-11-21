import { FEE_KINDS } from '../model';
import { invalidInput } from '../api/ownerFundsErrors';
import { FEE_BASES, FEE_TAX_MODES, MAX_AMOUNT_MINOR, MAX_BASIS_POINTS, MONTHS_MAX, MONTHS_MIN } from './model';
import type { FeeProposal } from './model';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isMinor = (value: number | null, max: number): value is number => value !== null && Number.isSafeInteger(value) && value >= 0 && value <= max;

export function simulationPayload(proposal: FeeProposal): Record<string, unknown> {
  if (!UUID.test(proposal.mandateId)) throw invalidInput('Choisissez un mandat.');
  if (!FEE_KINDS.includes(proposal.kind)) throw invalidInput('Choisissez le type d’honoraires.');
  if (!FEE_BASES.includes(proposal.base)) throw invalidInput('Choisissez la base des honoraires.');
  if (!FEE_TAX_MODES.includes(proposal.taxMode)) throw invalidInput('Choisissez le mode de taxe.');
  if (!Number.isInteger(proposal.months) || proposal.months < MONTHS_MIN || proposal.months > MONTHS_MAX) throw invalidInput('Choisissez entre 1 et 12 mois.');
  if (!isMinor(proposal.minimumAmount, MAX_AMOUNT_MINOR)) throw invalidInput('Le minimum mensuel est invalide.');
  if (proposal.kind === 'percentage' && !isMinor(proposal.basisPoints, MAX_BASIS_POINTS)) throw invalidInput('Le taux doit être compris entre 0 et 100 %.');
  if (proposal.kind === 'flat' && !isMinor(proposal.flatAmount, MAX_AMOUNT_MINOR)) throw invalidInput('Le forfait est invalide.');
  return {
    mandate_id: proposal.mandateId,
    fee_kind: proposal.kind,
    ...(proposal.kind === 'percentage' ? { fee_basis_points: proposal.basisPoints } : { fee_flat_amount: proposal.flatAmount }),
    fee_base: proposal.base,
    fee_minimum_amount: proposal.minimumAmount,
    fee_tax_mode: proposal.taxMode,
    months: proposal.months,
  };
}
