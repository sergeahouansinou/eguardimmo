import { z } from 'zod';
import { oneOf, pageOf, timestamp } from './apiKit';

export const INSPECTION_KINDS = ['entry', 'exit'] as const;
export const PERFORMERS = ['parties', 'agent', 'bailiff'] as const;
export const REMARK_KINDS = ['complement', 'heating', 'comment'] as const;
export type RemarkKind = (typeof REMARK_KINDS)[number];
export const REMARK_DECISIONS = ['accepted', 'refused', 'noted'] as const;

const inspection = z
  .object({
    id: z.uuid(),
    lease_id: z.uuid(),
    kind: z.enum(INSPECTION_KINDS),
    performed_on: z.iso.date(),
    performed_by: z.enum(PERFORMERS),
    signatories: z.array(z.object({ name: z.string(), capacity: z.string(), date: z.iso.date() })).nullable(),
    exit_matches_entry: z.boolean().nullable(),
    open_remark_kinds: z.array(z.enum(REMARK_KINDS)),
    published_at: timestamp.nullable(),
  })
  .transform((item) => ({
    id: item.id,
    leaseId: item.lease_id,
    kind: item.kind,
    performedOn: item.performed_on,
    performedBy: item.performed_by,
    signatories: item.signatories ?? [],
    exitMatchesEntry: item.exit_matches_entry,
    openRemarkKinds: item.open_remark_kinds,
    publishedAt: item.published_at,
  }));

export type Inspection = z.output<typeof inspection>;
export const inspectionSchema = oneOf(inspection);
export const inspectionPageSchema = pageOf(inspection);

const remark = z
  .object({
    id: z.uuid(),
    inspection_id: z.uuid(),
    kind: z.enum(REMARK_KINDS),
    body: z.string(),
    status: z.enum(['open', 'answered']),
    answer: z.object({ decision: z.enum(REMARK_DECISIONS), body: z.string().nullable(), answered_at: timestamp.nullable() }).nullable(),
    photos: z.array(z.object({ id: z.uuid(), position: z.number().int().nonnegative() })),
    created_at: timestamp,
  })
  .transform((item) => ({
    id: item.id,
    inspectionId: item.inspection_id,
    kind: item.kind,
    body: item.body,
    status: item.status,
    answer: item.answer === null ? null : { decision: item.answer.decision, body: item.answer.body, answeredAt: item.answer.answered_at },
    photos: item.photos,
    createdAt: item.created_at,
  }));

export type InspectionRemark = z.output<typeof remark>;
export const remarkSchema = oneOf(remark);
export const remarkPageSchema = pageOf(remark);
