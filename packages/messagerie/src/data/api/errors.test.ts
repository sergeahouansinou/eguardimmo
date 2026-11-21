import { ApiError } from '@eguardimmo/api';
import { describe, expect, it } from 'vitest';
import { errorMessage } from '../../lib/errors';

describe('errorMessage', () => {
  it('ajoute le délai d’attente d’un 429', () => {
    expect(errorMessage(new ApiError(429, 'too_many_requests', 'Trop de tentatives.', {}, 30))).toBe('Trop de tentatives. Réessayez dans 30 s.');
  });

  it('garde le message seul sans délai', () => {
    expect(errorMessage(new ApiError(403, 'space_forbidden', 'Accès refusé.'))).toBe('Accès refusé.');
  });
});
