import { z } from 'zod';
import { oneOf, pageOf, timestamp } from './apiKit';

export const NOTICE_STATUSES = ['submitted', 'acknowledged', 'withdrawn', 'closed'] as const;
export type NoticeStatus = (typeof NOTICE_STATUSES)[number];

const options = z
  .object({
    available: z.boolean(),
    unavailable_reason: z.string().nullable(),
    reasons: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        months: z.number().int().positive(),
        proof_required: z.boolean(),
        earliest_departure_on: z.iso.date(),
      }),
    ),
    consent: z.object({ version: z.string(), text: z.string() }),
    legal_notice: z.string(),
    to_confirm: z.boolean(),
  })
  .transform((item) => ({
    available: item.available,
    unavailableReason: item.unavailable_reason,
    reasons: item.reasons.map((reason) => ({
      key: reason.key,
      label: reason.label,
      months: reason.months,
      proofRequired: reason.proof_required,
      earliestDepartureOn: reason.earliest_departure_on,
    })),
    consent: item.consent,
    legalNotice: item.legal_notice,
    toConfirm: item.to_confirm,
  }));

export type NoticeOptions = z.output<typeof options>;
export type NoticeReasonOption = NoticeOptions['reasons'][number];
export const noticeOptionsSchema = oneOf(options);

const request = z
  .object({
    id: z.uuid(),
    lease_id: z.uuid(),
    status: z.enum(NOTICE_STATUSES),
    reason_key: z.string(),
    requested_departure_on: z.iso.date(),
    earliest_departure_on: z.iso.date(),
    departure_is_indicative: z.boolean(),
    received_on: z.iso.date().nullable(),
    has_proof: z.boolean(),
    has_letter: z.boolean(),
    forwarding_address: z.string().nullable(),
    acknowledgement_overdue: z.boolean(),
    closed_outcome: z.enum(['recorded', 'superseded']).nullable(),
    created_at: timestamp,
    acknowledged_at: timestamp.nullable(),
    withdrawn_at: timestamp.nullable(),
    closed_at: timestamp.nullable(),
  })
  .transform((item) => ({
    id: item.id,
    leaseId: item.lease_id,
    status: item.status,
    reasonKey: item.reason_key,
    requestedDepartureOn: item.requested_departure_on,
    earliestDepartureOn: item.earliest_departure_on,
    departureIsIndicative: item.departure_is_indicative,
    receivedOn: item.received_on,
    hasProof: item.has_proof,
    hasLetter: item.has_letter,
    forwardingAddress: item.forwarding_address,
    acknowledgementOverdue: item.acknowledgement_overdue,
    closedOutcome: item.closed_outcome,
    createdAt: item.created_at,
    acknowledgedAt: item.acknowledged_at,
    withdrawnAt: item.withdrawn_at,
    closedAt: item.closed_at,
  }));

export type NoticeRequest = z.output<typeof request>;
export const noticeRequestSchema = oneOf(request);
export const noticeRequestPageSchema = pageOf(request);
