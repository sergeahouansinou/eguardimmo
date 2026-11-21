import { z } from 'zod';
import { isoCurrency } from './currency';
import { ACCESS_LEVELS } from './model';

const id = z.guid();
const timestamp = z.iso.datetime({ offset: true });
const level = z.enum(ACCESS_LEVELS);

export const cursorMeta = z.object({ per_page: z.number().int().nonnegative(), next_cursor: z.string().nullable() });

export const apiOrganization = z.object({
  data: z.object({ id, kind: z.enum(['agency', 'individual']), name: z.string(), country: z.string(), currency: isoCurrency, timezone: z.string().min(1), two_factor_required: z.boolean() }),
});

export const apiMe = z.object({ data: z.object({ id, name: z.string() }) });

export const apiMembers = z.object({
  data: z.array(
    z.object({
      id,
      user_id: id.nullable(),
      first_name: z.string(),
      last_name: z.string(),
      status: z.enum(['active', 'invited', 'disabled']),
      self: z.boolean(),
      joined_at: timestamp.nullable(),
    }),
  ),
});

export const apiRoles = z.object({
  data: z.object({
    current_role: z.enum(['owner', 'admin', 'manager', 'accountant']),
    domains: z.array(z.object({ key: z.string().min(1), levels: z.object({ owner: level, admin: level, manager: level, accountant: level }), two_factor: z.boolean() })),
  }),
});

export const apiPropertyPage = z.object({ data: z.array(z.object({ id, name: z.string(), archived_at: timestamp.nullable() })), meta: cursorMeta });
export const apiUnitPage = z.object({ data: z.array(z.object({ id, reference: z.string() })), meta: cursorMeta });
export const apiLeasePage = z.object({
  data: z.array(
    z.object({
      id,
      reference: z.string(),
      archived_at: timestamp.nullable(),
      main_unit: z.object({ id, reference: z.string(), property: z.object({ id, name: z.string() }) }).nullable(),
      tenants: z.array(z.object({ display_name: z.string() })),
    }),
  ),
  meta: cursorMeta,
});

export const apiPartySearchPage = z.object({
  data: z.array(z.object({ id, display_name: z.string(), is_anonymized: z.boolean(), archived_at: timestamp.nullable() })),
  meta: cursorMeta,
});
export const apiPartyOne = z.object({ data: z.object({ id, display_name: z.string(), is_anonymized: z.boolean(), archived_at: timestamp.nullable() }) });
