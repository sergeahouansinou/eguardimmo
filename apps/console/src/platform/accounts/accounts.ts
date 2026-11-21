import type { ApiClient } from '@eguardimmo/api';
import { z } from 'zod';
import { CONSOLE_ROOT, count, dataOf, dateTime, nullableDateTime, parse, read, segment, write } from '../transport';

export const ACCOUNT_SUSPENSION_REASONS = ['fraud', 'abuse', 'legal_order', 'security'] as const;
export type AccountSuspensionReason = (typeof ACCOUNT_SUSPENSION_REASONS)[number];
export const VERIFICATION_METHODS = ['known_channel', 'video_call', 'document_seen'] as const;
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

const summarySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.string().nullable(),
  deleted: z.boolean(),
  suspended: z.boolean(),
  is_operator: z.boolean(),
});

const accountSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.string().nullable(),
  created_at: nullableDateTime,
  email_verified: z.boolean(),
  last_login_at: nullableDateTime,
  deleted: z.boolean(),
  deleted_at: nullableDateTime,
  is_operator: z.boolean(),
  suspension: z
    .object({ suspended_at: dateTime, reason: z.string().nullable(), reviewed: z.boolean(), reviewed_at: nullableDateTime })
    .nullable(),
  two_factor: z.object({ enabled: z.boolean(), recovery_codes_remaining: count.nullable() }),
  devices_count: count,
  tokens_count: count,
  profile_types: z.array(z.string()),
  organizations_count: count,
});

export interface AccountSummary {
  id: string;
  name: string;
  email: string | null;
  deleted: boolean;
  suspended: boolean;
  isOperator: boolean;
}

export interface Account {
  id: string;
  name: string;
  email: string | null;
  createdAt: string | null;
  emailVerified: boolean;
  lastLoginAt: string | null;
  deleted: boolean;
  deletedAt: string | null;
  isOperator: boolean;
  suspension: { suspendedAt: string; reason: string | null; reviewed: boolean; reviewedAt: string | null } | null;
  twoFactor: { enabled: boolean; recoveryCodesRemaining: number | null };
  devicesCount: number;
  tokensCount: number;
  profileTypes: string[];
  organizationsCount: number;
}

export type AccountLookup = { email: string } | { id: string };

export function toAccount(raw: z.infer<typeof accountSchema>): Account {
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    createdAt: raw.created_at,
    emailVerified: raw.email_verified,
    lastLoginAt: raw.last_login_at,
    deleted: raw.deleted,
    deletedAt: raw.deleted_at,
    isOperator: raw.is_operator,
    suspension:
      raw.suspension === null
        ? null
        : { suspendedAt: raw.suspension.suspended_at, reason: raw.suspension.reason, reviewed: raw.suspension.reviewed, reviewedAt: raw.suspension.reviewed_at },
    twoFactor: { enabled: raw.two_factor.enabled, recoveryCodesRemaining: raw.two_factor.recovery_codes_remaining },
    devicesCount: raw.devices_count,
    tokensCount: raw.tokens_count,
    profileTypes: raw.profile_types,
    organizationsCount: raw.organizations_count,
  };
}

export interface AccountsApi {
  search: (lookup: AccountLookup) => Promise<AccountSummary[]>;
  get: (id: string) => Promise<Account>;
  revokeSessions: (id: string) => Promise<Account>;
  suspend: (id: string, reason: AccountSuspensionReason) => Promise<Account>;
  reviewSuspension: (id: string) => Promise<Account>;
}

const single = dataOf(accountSchema);

export function accountsApi(client: ApiClient): AccountsApi {
  const path = (id: string, tail: string) => `/accounts/${segment(id)}${tail}`;
  return {
    search: async (lookup) => {
      const query = 'email' in lookup ? { email: lookup.email.trim() } : { id: lookup.id.trim() };
      const { data } = parse(z.object({ data: z.array(summarySchema).max(1) }), await client.get(`${CONSOLE_ROOT}/accounts`, query));
      return data.map((raw) => ({ id: raw.id, name: raw.name, email: raw.email, deleted: raw.deleted, suspended: raw.suspended, isOperator: raw.is_operator }));
    },
    get: async (id) => toAccount((await read(client, path(id, ''), single)).data),
    revokeSessions: async (id) => toAccount((await write(client, path(id, '/session-revocation'), single)).data),
    suspend: async (id, reason) => toAccount((await write(client, path(id, '/suspension'), single, { reason })).data),
    reviewSuspension: async (id) => toAccount((await write(client, path(id, '/suspension/review'), single)).data),
  };
}
