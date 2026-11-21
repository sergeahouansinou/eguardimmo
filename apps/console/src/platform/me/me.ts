import type { ApiClient } from '@eguardimmo/api';
import { z } from 'zod';
import { OPERATOR_ROLES } from '../roles';
import type { OperatorRole } from '../roles';
import { dataOf, dateTime, read } from '../transport';

const KNOWN_ROLES: readonly string[] = OPERATOR_ROLES;

const meSchema = dataOf(
  z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    email: z.email(),
    email_verified_at: dateTime.nullable(),
    phone: z.string().nullable(),
    last_login_at: dateTime.nullable(),
    previous_login_at: dateTime.nullable(),
    roles: z.array(z.string()),
  }),
);

export interface OperatorMe {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  lastLoginAt: string | null;
  previousLoginAt: string | null;
  roles: OperatorRole[];
}

export async function fetchOperator(client: ApiClient): Promise<OperatorMe> {
  const { data } = await read(client, '/me', meSchema);
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    lastLoginAt: data.last_login_at,
    previousLoginAt: data.previous_login_at,
    roles: data.roles.filter((role): role is OperatorRole => KNOWN_ROLES.includes(role)),
  };
}
