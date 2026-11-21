import { ApiError } from '@eguardimmo/api';
import { describe, expect, it } from 'vitest';
import { TenantRequestsError, translateApiError } from './errors';

function translate(status: number, code: string, detail = 'English server detail', retryAfter: number | null = null): TenantRequestsError {
  const result = translateApiError(new ApiError(status, code, detail, {}, retryAfter));
  if (!(result instanceof TenantRequestsError)) throw new Error('erreur non traduite');
  return result;
}

describe('traduction des erreurs du serveur', () => {
  it.each([
    [409, 'payment_installments_in_progress', 'conflict', /paiement en plusieurs fois/],
    [422, 'payment_nothing_due', 'invalid', /Il ne reste rien à payer/],
    [422, 'lease_document_invalid', 'invalid', /fichier téléversé pour ce bail/],
    [403, 'insurance_submission_not_allowed', 'forbidden', /dépôt d’attestation n’est pas possible/],
    [409, 'inspection_published', 'conflict', /publié, donc figé/],
    [409, 'inspection_stale_version', 'stale', /rechargez la page/],
  ] as const)('%s %s en français clair, sans le détail anglais du serveur', (status, code, kind, message) => {
    const error = translate(status, code);
    expect(error.kind).toBe(kind);
    expect(error.message).toMatch(message);
    expect(error.message).not.toContain('English server detail');
  });

  it('traduit les statuts génériques', () => {
    expect(translate(401, 'unauthenticated').kind).toBe('unauthenticated');
    expect(translate(403, 'forbidden').kind).toBe('forbidden');
    expect(translate(429, 'too_many_requests', 'x', 30).message).toContain('dans 30 secondes');
    expect(translate(403, 'two_factor_required').kind).toBe('two_factor_required');
    expect(translate(403, 'reauthentication_required').kind).toBe('reauthentication_required');
  });
});
