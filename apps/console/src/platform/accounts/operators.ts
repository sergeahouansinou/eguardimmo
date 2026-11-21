import type { ApiClient } from '@eguardimmo/api';
import { z } from 'zod';
import { dateTime, nullableDateTime, read } from '../transport';
import { OPERATOR_ROLES } from '../roles';
import type { OperatorRole } from '../roles';

const operatorSchema = z.object({
  id: z.string().min(1),
  name: z.string().nullable(),
  email: z.string().nullable(),
  roles: z.array(z.string()),
  two_factor_confirmed: z.boolean(),
  last_login_at: nullableDateTime,
  state: z.enum(['active', 'revoked']),
  granted_at: dateTime,
});

export interface OperatorRow {
  id: string;
  name: string | null;
  email: string | null;
  roles: OperatorRole[];
  twoFactorConfirmed: boolean;
  lastLoginAt: string | null;
  state: 'active' | 'revoked';
  grantedAt: string;
}

const KNOWN: readonly string[] = OPERATOR_ROLES;

export interface OperatorsApi {
  list: () => Promise<OperatorRow[]>;
}

export function operatorsApi(client: ApiClient): OperatorsApi {
  return {
    list: async () => {
      const { data } = await read(client, '/operators', z.object({ data: z.array(operatorSchema) }));
      return data.map((raw) => ({
        id: raw.id,
        name: raw.name,
        email: raw.email,
        roles: raw.roles.filter((role): role is OperatorRole => KNOWN.includes(role)),
        twoFactorConfirmed: raw.two_factor_confirmed,
        lastLoginAt: raw.last_login_at,
        state: raw.state,
        grantedAt: raw.granted_at,
      }));
    },
  };
}
