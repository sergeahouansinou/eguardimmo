import type { AccountLookup } from '@/platform/accounts/accounts';
import type { LookupMode } from './labels';

const EMAIL_MAX = 254;
const ID_MAX = 64;

export type LookupResult = { ok: true; lookup: AccountLookup } | { ok: false; error: string };

export function buildLookup(mode: LookupMode, raw: string): LookupResult {
  const value = raw.trim();
  if (value === '') return { ok: false, error: mode === 'email' ? 'Saisissez une adresse e-mail.' : 'Saisissez un identifiant de compte.' };
  if (mode === 'email') {
    if (value.length > EMAIL_MAX || !/^[^\s@]+@[^\s@]+$/.test(value)) return { ok: false, error: 'Saisissez une adresse e-mail complète.' };
    return { ok: true, lookup: { email: value } };
  }
  if (value.length > ID_MAX || /\s/.test(value)) return { ok: false, error: 'Identifiant invalide : sans espace, 64 caractères au plus.' };
  return { ok: true, lookup: { id: value } };
}
