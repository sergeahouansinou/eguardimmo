import { ApiError } from '@eguardimmo/api';
import type { ApiClient } from '@eguardimmo/api';

export const REAUTHENTICATION_CODE = 'reauthentication_required';
export const TWO_FACTOR_CODE = 'two_factor_required';

export type ProofOutcome = { status: 'ok' } | { status: 'invalid' } | { status: 'rate_limited'; retryAfterSeconds: number | null };

export type ConfirmProof = (entry: string) => Promise<ProofOutcome>;

const TOTP_PATTERN = /^\d{6}$/;

export function codeOf(error: unknown): string | null {
  if (error instanceof ApiError) return error.code;
  if (error instanceof Error && 'code' in error && typeof error.code === 'string') return error.code;
  return null;
}

export const isReauthenticationRequired = (error: unknown): boolean => codeOf(error) === REAUTHENTICATION_CODE;
export const isTwoFactorRequired = (error: unknown): boolean => codeOf(error) === TWO_FACTOR_CODE;

export function createConfirmProof(client: ApiClient): ConfirmProof {
  return async (entry) => {
    const value = entry.replace(/\s+/g, '');
    if (value === '') return { status: 'invalid' };
    const body = TOTP_PATTERN.test(value) ? { code: value } : { recovery_code: value };
    try {
      await client.post('/auth/reauthenticate/two-factor', body);
      return { status: 'ok' };
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) return { status: 'invalid' };
      if (error instanceof ApiError && error.status === 429) return { status: 'rate_limited', retryAfterSeconds: error.retryAfterSeconds };
      throw error;
    }
  };
}

export function waitText(seconds: number | null): string {
  if (seconds === null || seconds < 1) return 'un peu plus tard';
  if (seconds <= 90) return `dans ${String(seconds)} seconde${seconds > 1 ? 's' : ''}`;
  return `dans ${String(Math.ceil(seconds / 60))} minutes`;
}
