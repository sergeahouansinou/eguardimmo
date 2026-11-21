import { z } from 'zod';
import { ACTIVITY_TYPES, ACTOR_KINDS } from '../model';

const id = z.guid();
const timestamp = z.iso.datetime({ offset: true });

const actor = z.object({ kind: z.enum(ACTOR_KINDS), id: z.string().nullable(), name: z.string().nullable(), active: z.boolean().nullable() });
const subject = z.object({ type: z.string().min(1), id: z.string().min(1) }).nullable();

const entryBase = {
  id,
  occurred_at: timestamp,
  type: z.enum(ACTIVITY_TYPES),
  label: z.string(),
  actor,
  subject,
};

export const apiEntryRow = z.object({ ...entryBase, action: z.string().nullish(), ip: z.string().nullish(), device: z.string().nullish() });

export const apiEntryPage = z.object({
  data: z.array(apiEntryRow),
  meta: z.object({ has_more: z.boolean(), next_cursor: z.string().nullable() }),
});

export const apiEntryDetail = z.object({
  data: z.object({
    ...entryBase,
    action: z.string(),
    ip: z.string().nullable(),
    device: z.string().nullable(),
    reference: z.string().nullable(),
    changes: z.record(z.string(), z.object({ old: z.unknown(), new: z.unknown() })),
    metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  }),
});

export type ApiEntryRow = z.infer<typeof apiEntryRow>;
export type ApiEntryDetail = z.infer<typeof apiEntryDetail>['data'];
