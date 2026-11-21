import { ApiError } from '@eguardimmo/api';
import { describe, expect, it } from 'vitest';
import { CODE_MESSAGES, MaintenanceApiError, translateApiError } from './maintenanceErrors';

const BACKEND_CODES = [
  'intervention_not_found', 'intervention_lease_not_found', 'intervention_visit_not_found', 'intervention_quote_not_found', 'intervention_approval_not_found',
  'supplier_invoice_not_found', 'invoice_allocation_not_found', 'supplier_payment_not_found', 'supplier_not_found', 'intervention_file_not_found',
  'intervention_stale_version', 'intervention_transition_invalid', 'maintenance_idempotency_key_reused', 'approval_already_decided', 'approval_already_pending',
  'supplier_invoice_duplicate', 'quote_frozen', 'quote_status_invalid', 'visit_status_invalid', 'supplier_invoice_status_invalid', 'intervention_close_blocked',
  'intervention_reopen_blocked', 'supplier_status_invalid', 'intervention_lease_not_active', 'intervention_too_many_open', 'intervention_unit_invalid',
  'intervention_no_mandate', 'intervention_mandate_suspended', 'intervention_qualification_incomplete', 'intervention_approval_required', 'approval_proof_required',
  'intervention_emergency_not_allowed', 'intervention_files_limit', 'intervention_file_invalid', 'supplier_insurance_missing', 'supplier_unavailable',
  'intervention_supplier_required', 'quote_total_mismatch', 'quote_lines_invalid', 'maintenance_tax_rate_unknown', 'maintenance_currency_mismatch',
  'supplier_invoice_totals_invalid', 'supplier_invoice_exceeds_approval', 'supplier_invoice_not_allocable', 'allocation_exceeds_invoice',
  'allocation_deposit_unavailable', 'allocation_not_chargeable', 'payment_exceeds_outstanding', 'supplier_payment_invalid', 'maintenance_jurisdiction_unsupported',
  'idempotency_key_required',
];

describe('traduction des erreurs', () => {
  it('traduit tous les codes de ErrorCode', () => {
    expect(Object.keys(CODE_MESSAGES).sort()).toEqual([...BACKEND_CODES].sort());
    for (const code of BACKEND_CODES) expect(CODE_MESSAGES[code]).toMatch(/[a-zé]{4}/);
  });

  it.each([
    [403, 'forbidden', 'two_factor_required', /Connexion et sécurité/],
    [403, 'forbidden', 'supplier_payment_second_approver_required', /second validateur/i],
    [409, 'conflict', 'supplier_payment_engagement_required', /engagement est requis/],
    [409, 'conflict', 'owner_funds_insufficient', /solde du mandant/],
    [409, 'conflict', 'trust_funds_gap', /cantonnement/],
  ])('traduit le code %s %s %s des fonds de tiers', (status, kind, code, message) => {
    expect(translateApiError(new ApiError(status, code, 'brut'))).toMatchObject({ kind, message: expect.stringMatching(message) as unknown, status, code });
  });

  it.each([
    [401, 'unauthenticated', 'x', 'Votre session a expiré. Reconnectez-vous.'],
    [403, 'forbidden', 'x', 'Votre rôle ne permet pas cette action sur les interventions.'],
    [404, 'not_found', 'intervention_not_found', 'Cette intervention n’existe pas dans votre organisation.'],
    [409, 'stale', 'intervention_stale_version', 'Cette intervention a été modifiée depuis votre lecture : rechargez la page avant de recommencer.'],
    [409, 'conflict', 'quote_frozen', 'Ce devis est figé : il a déjà été soumis au mandant et ne peut plus être modifié.'],
    [422, 'invalid', 'approval_proof_required', 'Joignez la pièce écrite du mandant (courriel, courrier ou message) pour enregistrer sa décision.'],
    [503, 'unavailable', 'x', 'Le service des interventions est momentanément indisponible. Rien n’a été enregistré : réessayez dans un instant.'],
  ])('traduit le statut %s en %s', (status, kind, code, message) => {
    const result = translateApiError(new ApiError(status, code, 'brut'));
    expect(result).toBeInstanceOf(MaintenanceApiError);
    expect(result).toMatchObject({ kind, message, status, code });
  });

  it.each([
    [422, 'intervention_emergency_not_allowed', /plafond d’urgence/],
    [422, 'intervention_approval_required', /dépasse la couverture accordée/],
    [422, 'supplier_invoice_exceeds_approval', /avenant accepté/],
    [409, 'maintenance_idempotency_key_reused', /contenu différent/],
    [409, 'approval_already_decided', /expiré/],
    [422, 'intervention_file_invalid', /preuve déjà utilisée/],
    [422, 'quote_lines_invalid', /plausible/],
    [409, 'visit_status_invalid', /planification/],
  ])('traduit le %s %s de la revue sécurité', (status, code, pattern) => {
    expect((translateApiError(new ApiError(status, code, 'brut')) as Error).message).toMatch(pattern);
  });

  it('traduit un 422 validation_failed sur la priorité', () => {
    const result = translateApiError(new ApiError(422, 'validation_failed', 'brut', { priority: ['invalide'] }));
    expect((result as Error).message).toBe('La priorité est invalide.');
  });

  it('traduit un 429 avec le délai annoncé', () => {
    const result = translateApiError(new ApiError(429, 'throttled', 'brut', {}, 30));
    expect(result).toMatchObject({ kind: 'rate_limited' });
    expect((result as Error).message).toContain('dans 30 secondes');
  });

  it('utilise le message du champ fautif pour un 422 sans code connu', () => {
    const result = translateApiError(new ApiError(422, 'validation_failed', 'brut', { 'lines.0.quantity_milli': ['invalide'] }));
    expect((result as Error).message).toBe('La quantité d’une ligne est invalide.');
  });

  it('laisse passer une erreur étrangère', () => {
    const error = new Error('réseau');
    expect(translateApiError(error)).toBe(error);
  });
});
