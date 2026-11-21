import { z } from 'zod';
import { oneOf, timestamp } from './apiKit';

export const SUBMISSION_STATUSES = ['pending', 'accepted', 'rejected', 'withdrawn'] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const REJECTION_REASONS = ['unreadable', 'wrong_person', 'wrong_address', 'expired', 'missing_rental_risks', 'other'] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

export const COVERAGE_STATES = ['valid', 'expiring', 'missing'] as const;
export type CoverageState = (typeof COVERAGE_STATES)[number];

const submission = z
  .object({
    id: z.uuid(),
    status: z.enum(SUBMISSION_STATUSES),
    insurer: z.string(),
    policy_number: z.string(),
    starts_on: z.iso.date(),
    ends_on: z.iso.date(),
    rejection_reason: z.enum(REJECTION_REASONS).nullable(),
    note: z.string().nullable(),
    created_at: timestamp,
    decided_at: timestamp.nullable(),
  })
  .transform((item) => ({
    id: item.id,
    status: item.status,
    insurer: item.insurer,
    policyNumber: item.policy_number,
    startsOn: item.starts_on,
    endsOn: item.ends_on,
    rejectionReason: item.rejection_reason,
    note: item.note,
    createdAt: item.created_at,
    decidedAt: item.decided_at,
  }));

export type InsuranceSubmission = z.output<typeof submission>;
export const submissionSchema = oneOf(submission);

export const insuranceSchema = oneOf(
  z
    .object({
      coverage: z.object({ state: z.enum(COVERAGE_STATES), ends_on: z.iso.date().nullable() }),
      submissions: z.array(submission),
    })
    .transform((item) => ({ coverage: { state: item.coverage.state, endsOn: item.coverage.ends_on }, submissions: item.submissions })),
);
export type Insurance = z.output<typeof insuranceSchema>['data'];
