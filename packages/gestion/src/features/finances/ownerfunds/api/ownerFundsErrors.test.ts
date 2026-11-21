import { ApiError } from '@eguardimmo/api';
import { describe, expect, it } from 'vitest';
import { CODE_MESSAGES, OwnerFundsApiError, TWO_FACTOR_MESSAGE, closingReasons, translateApiError } from './ownerFundsErrors';
import * as api from './responses.fixtures';

interface Problem {
  status: number;
  code: string;
  detail: string;
  errors?: Record<string, string[]>;
}

const apiError = (problem: Problem, retry: number | null = null): ApiError => new ApiError(problem.status, problem.code, problem.detail, problem.errors ?? {}, retry);

const translated = (error: unknown): OwnerFundsApiError => {
  const result = translateApiError(error);
  expect(result).toBeInstanceOf(OwnerFundsApiError);
  return result as OwnerFundsApiError;
};

describe('translateApiError', () => {
  it('laisse passer une erreur qui n’est pas une erreur d’API', () => {
    const boom = new Error('boum');
    expect(translateApiError(boom)).toBe(boom);
  });

  it.each([
    [api.problemStale, 'stale', 'rechargez-le'],
    [{ status: 409, code: 'payout_account_request_stale', detail: 'x' }, 'stale', 'changé depuis votre lecture'],
    [api.problemNotValidatable, 'conflict', 'validé ou exporté'],
    [api.problemFundsGap, 'conflict', 'cantonnement'],
    [api.problemKeyReused, 'conflict', 'contenu différent'],
    [api.problemExceedsSurplus, 'conflict', 'excédent'],
    [api.problemDepositNotActionable, 'conflict', 'déjà été confirmé'],
    [api.problemAccountChanged, 'conflict', 'reconnaissance du changement'],
    [api.problemPeriodOrder, 'conflict', 'dans l’ordre'],
    [api.problemSupplierEngagement, 'conflict', 'devis'],
    [api.problemOwnerInsufficient, 'conflict', 'avance sur fonds propres'],
    [api.problemBatchNotFound, 'not_found', 'n’existe pas'],
    [api.problemMandantNotFound, 'not_found', 'Ce mandant'],
    [api.problemAgencyOnly, 'forbidden', 'type agence'],
    [api.problemSecondApprover, 'forbidden', 'second validateur'],
    [api.problemSupplierSecondApprover, 'forbidden', 'second validateur'],
    [api.problemKeyRequired, 'invalid', 'clé de saisie'],
  ] as const)('traduit %#', (problem, kind, fragment) => {
    const error = translated(apiError(problem));
    expect(error.kind).toBe(kind);
    expect(error.message.toLowerCase()).toContain(fragment.toLowerCase());
    expect(error.code).toBe(problem.code);
  });

  it('renvoie la double authentification vers Mon compte, Connexion et sécurité', () => {
    const error = translated(apiError(api.problemTwoFactor));
    expect(error.kind).toBe('two_factor_required');
    expect(error.message).toBe(TWO_FACTOR_MESSAGE);
    expect(error.message).toContain('Connexion et sécurité');
  });

  it('traduit en français tous les codes du module et du règlement prestataire', () => {
    for (const code of [
      'payout_batch_not_found', 'payout_item_not_found', 'payout_hold_not_found', 'owner_funds_mandant_not_found', 'trust_deposit_not_found', 'trust_deposit_not_actionable',
      'payout_stale_version', 'payout_not_validatable', 'payout_item_excluded', 'payout_second_approver_required', 'payout_cancel_forbidden', 'payout_item_not_actionable',
      'payout_account_changed', 'owner_funds_agency_only', 'owner_funds_idempotency_key_required', 'owner_funds_idempotency_key_reused', 'owner_funds_insufficient',
      'fee_base_missing', 'period_not_closed', 'trust_funds_gap', 'trust_withdrawal_exceeds_surplus', 'owner_funds_jurisdiction_unsupported', 'payout_nothing_to_pay',
      'accounting_period_closed', 'accounting_period_order', 'accounting_period_not_closable', 'invoice_fee_computed_by_server',
      'supplier_payment_engagement_required', 'owner_funds_insufficient', 'supplier_payment_second_approver_required', 'two_factor_required',
    ]) {
      expect(CODE_MESSAGES[code], code).toMatch(/[a-zé]{4}/i);
    }
  });

  it('donne le motif du refus de clôture et en garde la liste', () => {
    const error = translated(apiError(api.problemNotClosable));
    expect(error.reasons).toEqual(['trust_funds_gap', 'payouts_in_transit_mismatch']);
    expect(error.message).toContain('ne couvrent pas les sommes dues');
    expect(error.message).toContain('virements en cours');
    expect(translated(apiError(api.problemNotClosableMonthNotOver)).message).toContain('pas encore terminé');
  });

  it('extrait les motifs d’un détail de clôture', () => {
    expect(closingReasons('Motifs : a, b.')).toEqual(['a', 'b']);
    expect(closingReasons('autre texte')).toEqual([]);
  });

  it('cite le champ invalide d’un 422', () => {
    expect(translated(apiError(api.problemValidation)).message).toContain('La référence est invalide');
  });

  it('traite 401, 429 et 503 sans promettre une écriture', () => {
    expect(translated(apiError({ status: 401, code: 'unauthenticated', detail: 'x' })).kind).toBe('unauthenticated');
    const limited = translated(apiError({ status: 429, code: 'too_many_requests', detail: 'x' }, 12));
    expect(limited.kind).toBe('rate_limited');
    expect(limited.message).toContain('dans 12 secondes');
    expect(limited.message).toContain('Aucune modification');
    expect(translated(apiError({ status: 503, code: 'unavailable', detail: 'x' })).kind).toBe('unavailable');
  });

  it('laisse un code de rôle générique sur un 403 sans message connu', () => {
    expect(translated(apiError({ status: 403, code: 'autre', detail: 'x' })).message).toContain('rôle');
  });
});
