import type { ApiClient } from '@eguardimmo/api';
import { z } from 'zod';
import { CONSOLE_ROOT, cursorParams, dataOf, dateTime, emptyObjectOrList, filled, flag, listOf, nullableDateTime, parse, read, segment, write } from '../transport';
import type { CursorPage, CursorQuery } from '../transport';

export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'expired', 'cancelled', 'failed'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const APPROVAL_ACTIONS = [
  'organizations.suspend',
  'organizations.reactivate',
  'identity.account.reactivate',
  'identity.account.reset_two_factor',
  'subscriptions.plan_version.publish',
  'subscriptions.override.grant',
  'subscriptions.override.revoke',
  'privacy.erasure.execute',
] as const;
export type ApprovalAction = (typeof APPROVAL_ACTIONS)[number];

const person = z.object({ id: z.string().min(1), name: z.string().nullable() });

const approvalSchema = z.object({
  id: z.string().min(1),
  action: z.string().min(1),
  subject: z.object({ type: z.string().min(1), id: z.string().min(1) }),
  organization_id: z.string().nullable(),
  status: z.enum(APPROVAL_STATUSES),
  reason: z.string(),
  ticket_reference: z.string().nullable(),
  payload: emptyObjectOrList.nullable(),
  requested_by: person,
  requested_proof: z.string(),
  decided_by: person.nullable(),
  decided_proof: z.string().nullable(),
  decided_at: nullableDateTime,
  executed_at: nullableDateTime,
  failure_code: z.string().nullable(),
  expires_at: dateTime,
  created_at: dateTime,
  lock_version: z.number().int().nonnegative(),
  permissions: z.object({ can_decide: z.boolean(), can_cancel: z.boolean() }),
});

const listSchema = listOf(approvalSchema, { pending_count: z.number().int().nonnegative() });

export interface Approval {
  id: string;
  action: string;
  subjectType: string;
  subjectId: string;
  organizationId: string | null;
  status: ApprovalStatus;
  reason: string;
  ticketReference: string | null;
  payload: { key: string; value: string }[];
  requestedBy: { id: string; name: string | null };
  decidedBy: { id: string; name: string | null } | null;
  decidedAt: string | null;
  executedAt: string | null;
  failureCode: string | null;
  expiresAt: string;
  createdAt: string;
  canDecide: boolean;
  canCancel: boolean;
}

export interface ApprovalPage extends CursorPage<Approval> {
  pendingCount: number;
}

export interface ApprovalQuery extends CursorQuery {
  status?: ApprovalStatus;
  action?: string;
  mine?: boolean;
}

export interface ApprovalRequestInput {
  action: ApprovalAction;
  subjectId: string;
  reason: string;
  ticketReference?: string;
  payload?: Record<string, string>;
}

type ApiApproval = z.infer<typeof approvalSchema>;

function show(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

export function toApproval(raw: ApiApproval): Approval {
  const payload = raw.payload === null || Array.isArray(raw.payload) ? {} : raw.payload;
  return {
    id: raw.id,
    action: raw.action,
    subjectType: raw.subject.type,
    subjectId: raw.subject.id,
    organizationId: raw.organization_id,
    status: raw.status,
    reason: raw.reason,
    ticketReference: raw.ticket_reference,
    payload: Object.entries(payload).map(([key, value]) => ({ key, value: show(value) })),
    requestedBy: raw.requested_by,
    decidedBy: raw.decided_by,
    decidedAt: raw.decided_at,
    executedAt: raw.executed_at,
    failureCode: raw.failure_code,
    expiresAt: raw.expires_at,
    createdAt: raw.created_at,
    canDecide: raw.permissions.can_decide,
    canCancel: raw.permissions.can_cancel,
  };
}

export interface ApprovalsApi {
  list: (query?: ApprovalQuery) => Promise<ApprovalPage>;
  get: (id: string) => Promise<Approval>;
  request: (input: ApprovalRequestInput) => Promise<Approval>;
  approve: (id: string) => Promise<Approval>;
  reject: (id: string) => Promise<Approval>;
  cancel: (id: string) => Promise<Approval>;
}

const single = dataOf(approvalSchema);

export function approvalsApi(client: ApiClient): ApprovalsApi {
  const decide = async (id: string, verb: 'approve' | 'reject' | 'cancel') =>
    toApproval((await write(client, `/approvals/${segment(id)}/${verb}`, single)).data);
  return {
    list: async (query = {}) => {
      const { data, meta } = parse(
        listSchema,
        await client.get(`${CONSOLE_ROOT}/approvals`, {
          ...cursorParams(query),
          status: query.status,
          action: filled(query.action),
          mine: flag(query.mine),
        }),
      );
      return { rows: data.map(toApproval), hasMore: meta.has_more, nextCursor: meta.next_cursor, pendingCount: meta.pending_count };
    },
    get: async (id) => toApproval((await read(client, `/approvals/${segment(id)}`, single)).data),
    request: async (input) =>
      toApproval(
        (
          await write(client, '/approvals', single, {
            action: input.action,
            subject_id: input.subjectId,
            reason: input.reason,
            ...(filled(input.ticketReference) === undefined ? {} : { ticket_reference: filled(input.ticketReference) }),
            ...(input.payload === undefined || Object.keys(input.payload).length === 0 ? {} : { payload: input.payload }),
          })
        ).data,
      ),
    approve: (id) => decide(id, 'approve'),
    reject: (id) => decide(id, 'reject'),
    cancel: (id) => decide(id, 'cancel'),
  };
}
