import { z } from 'zod';

export const API_ROLES = { owner: 'titulaire', admin: 'administrateur', manager: 'gestionnaire', accountant: 'comptable' } as const;
export const API_STATUSES = { active: 'actif', invited: 'invite', disabled: 'desactive' } as const;
export const API_TWO_FACTOR = { enabled: 'activee', disabled: 'non-activee', pending: 'a-l-acceptation' } as const;

const iso = z.iso.datetime({ offset: true });

export const apiMemberSchema = z.object({
  id: z.uuid(),
  first_name: z.string(),
  last_name: z.string(),
  email: z.email(),
  role: z.enum(['owner', 'admin', 'manager', 'accountant']),
  status: z.enum(['active', 'invited', 'disabled']),
  scope: z.object({ type: z.enum(['all', 'selected']), property_ids: z.array(z.uuid()) }),
  two_factor: z.enum(['enabled', 'disabled', 'pending']),
  last_login_at: iso.nullable(),
  invited_at: iso.nullable(),
  joined_at: iso.nullable(),
  message: z.string().nullable(),
  self: z.boolean(),
});
export type ApiMember = z.infer<typeof apiMemberSchema>;

export const apiTeamSchema = z.object({
  data: z.array(apiMemberSchema),
  meta: z.object({ two_factor_required: z.boolean(), seat_limit: z.number().int().positive().nullable() }),
});

export const apiMemberEnvelopeSchema = z.object({ data: apiMemberSchema });
