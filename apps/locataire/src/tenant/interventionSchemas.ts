import { z } from 'zod';
import { REPORTED_URGENCIES, TENANT_STATES, VISIT_SLOTS, VISIT_STATUSES } from './interventionModel';

const isoDate = z.iso.date();
const timestamp = z.iso.datetime({ offset: true });

const visit = z.object({
  id: z.uuid(),
  scheduled_on: isoDate,
  slot: z.enum(VISIT_SLOTS),
  presence_required: z.boolean(),
  status: z.enum(VISIT_STATUSES),
  requested_on: isoDate.nullable(),
  requested_slot: z.enum(VISIT_SLOTS).nullable(),
  contact_name: z.string().nullable(),
  contact_phone: z.string().nullable(),
});

const intervention = z.object({
  id: z.uuid(),
  reference: z.string(),
  state: z.enum(TENANT_STATES),
  nature: z.object({ key: z.string().nullable(), label: z.string().nullable() }),
  title: z.string(),
  description: z.string(),
  room: z.string().nullable(),
  availability: z.string().nullable(),
  reported_urgency: z.enum(REPORTED_URGENCIES).nullable(),
  place: z.string(),
  reported_on: isoDate,
  decline: z.object({ reason: z.string(), note: z.string().nullable() }).nullable(),
  completed_on: isoDate.nullable(),
  visits: z.array(visit),
  cancellable: z.boolean(),
  events: z.array(z.object({ id: z.uuid(), kind: z.string(), author: z.enum(['tenant', 'team']), text: z.string(), created_at: timestamp })).optional(),
  files: z.array(z.object({ id: z.uuid(), kind: z.string(), uploaded_by: z.enum(['tenant', 'team']), created_at: timestamp.nullable() })).optional(),
});
export type ApiIntervention = z.infer<typeof intervention>;

export const interventionPageSchema = z.object({ data: z.array(intervention), meta: z.object({ next_cursor: z.string().nullable() }) });
export const interventionSchema = z.object({ data: intervention });

export const optionsSchema = z.object({
  data: z.array(
    z.object({
      lease_id: z.uuid(),
      label: z.string(),
      units: z.array(z.object({ id: z.uuid(), label: z.string() })),
      common_area_allowed: z.boolean(),
      natures: z.array(z.object({ id: z.uuid(), key: z.string(), label: z.string() })),
    }),
  ),
});
