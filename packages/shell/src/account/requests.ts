import { listProfiles } from '@eguardimmo/api';
import type { ApiClient, ApiProfile } from '@eguardimmo/api';
import { z } from 'zod';
import type { AccountDevice, AccountIdentity, AccountSecurity } from './model';
import { devicesResponseSchema, identityResponseSchema, securityResponseSchema } from './schemas';

export class UnexpectedAccountResponseError extends Error {
  constructor() {
    super('Le serveur a répondu de façon inattendue. Réessayez dans un instant.');
    this.name = 'UnexpectedAccountResponseError';
  }
}

function parse<S extends z.ZodType>(schema: S, payload: unknown): z.infer<S> {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new UnexpectedAccountResponseError();
  return parsed.data;
}

export async function fetchIdentity(client: ApiClient): Promise<AccountIdentity> {
  const { data } = parse(identityResponseSchema, await client.get('/api/v1/me'));
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    emailVerifiedAt: data.email_verified_at,
    lastLoginAt: data.last_login_at,
    previousLoginAt: data.previous_login_at,
  };
}

export async function fetchProfiles(client: ApiClient): Promise<ApiProfile[]> {
  try {
    return await listProfiles(client);
  } catch (error) {
    if (error instanceof z.ZodError) throw new UnexpectedAccountResponseError();
    throw error;
  }
}

export async function fetchSecurity(client: ApiClient): Promise<AccountSecurity> {
  const { data } = parse(securityResponseSchema, await client.get('/api/v1/me/security'));
  return {
    email: data.email,
    emailVerified: data.email_verified,
    hasPassword: data.has_password,
    twoFactor: {
      enabled: data.two_factor.enabled,
      enabledAt: data.two_factor.enabled_at,
      backupCodesRemaining: data.two_factor.backup_codes_remaining,
      backupCodesTotal: data.two_factor.backup_codes_total,
    },
    linkedAccounts: data.linked_accounts.map((account) => ({
      provider: account.provider,
      linked: account.linked,
      email: account.email,
      linkedAt: account.linked_at,
    })),
  };
}

export async function fetchDevices(client: ApiClient): Promise<AccountDevice[]> {
  const { data } = parse(devicesResponseSchema, await client.get('/api/v1/me/devices'));
  return data.map((device) => ({
    id: device.id,
    name: device.name,
    lastUsedAt: device.last_used_at,
    createdAt: device.created_at,
    current: device.current,
  }));
}

export async function revokeDevice(client: ApiClient, deviceId: string): Promise<void> {
  await client.delete(`/api/v1/me/devices/${encodeURIComponent(deviceId)}`);
}
