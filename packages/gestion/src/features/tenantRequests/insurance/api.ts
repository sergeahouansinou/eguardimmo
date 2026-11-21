import type { ApiClient } from '@eguardimmo/api';
import { z } from 'zod';
import { id, isoDate, oneOf, pageOf, timestamp } from '../shared/schemas';
import { createTransport } from '../shared/transport';
import { COVERAGE_STATES, INSURANCE_STATUSES, REJECTION_REASONS } from './model';
import type { InsuranceSubmission } from './model';
import type { InsuranceSource } from './source';

export const apiSubmissionSchema = z.object({
  id,
  lease_id: id,
  party_id: id,
  stored_file_id: id,
  insurer: z.string(),
  policy_number: z.string(),
  starts_on: isoDate,
  ends_on: isoDate,
  status: z.enum(INSURANCE_STATUSES),
  rejection_reason: z.enum(REJECTION_REASONS).nullable(),
  note: z.string().nullable(),
  decided_by_user_id: id.nullable(),
  decided_at: timestamp.nullable(),
  certificate_id: id.nullable(),
  created_at: timestamp,
});

const apiSubmissionPage = pageOf(apiSubmissionSchema);
const apiSubmissionResponse = oneOf(apiSubmissionSchema);
const apiOverviewResponse = oneOf(
  z.object({
    coverage: z.object({ state: z.enum(COVERAGE_STATES), ends_on: isoDate.nullable() }),
    submissions: z.array(apiSubmissionSchema),
  }),
);
const apiReminderResponse = oneOf(z.object({ status: z.literal('sent') }));

export const toSubmission = (row: z.infer<typeof apiSubmissionSchema>): InsuranceSubmission => ({
  id: row.id,
  leaseId: row.lease_id,
  partyId: row.party_id,
  storedFileId: row.stored_file_id,
  insurer: row.insurer,
  policyNumber: row.policy_number,
  startsOn: row.starts_on,
  endsOn: row.ends_on,
  status: row.status,
  rejectionReason: row.rejection_reason,
  note: row.note,
  decidedAt: row.decided_at,
  certificateId: row.certificate_id,
  createdAt: row.created_at,
});

const PAGE_SIZE = 25;
const segment = encodeURIComponent;
const FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

export interface ApiInsuranceOptions {
  client: ApiClient;
  organizationId: string | null;
  fetchImpl?: typeof fetch;
}

export function createApiInsuranceSource({ client, organizationId, fetchImpl }: ApiInsuranceOptions): InsuranceSource {
  const transport = createTransport(client, organizationId, fetchImpl);
  return {
    list: async (query) => {
      const page = await transport.get('/insurance-submissions', apiSubmissionPage, { per_page: PAGE_SIZE, cursor: query.cursor, status: query.status ?? undefined });
      return { items: page.data.map(toSubmission), nextCursor: page.meta.next_cursor };
    },
    overview: async (leaseId) => {
      const { data } = await transport.get(`/leases/${segment(leaseId)}/insurance`, apiOverviewResponse);
      return { coverage: { state: data.coverage.state, endsOn: data.coverage.ends_on }, submissions: data.submissions.map(toSubmission) };
    },
    accept: async (submissionId) => toSubmission((await transport.post(`/insurance-submissions/${segment(submissionId)}/accept`, apiSubmissionResponse)).data),
    reject: async (submissionId, reason, note) =>
      toSubmission((await transport.post(`/insurance-submissions/${segment(submissionId)}/reject`, apiSubmissionResponse, { reason, note })).data),
    remind: async (leaseId) => {
      await transport.post(`/leases/${segment(leaseId)}/insurance/reminder`, apiReminderResponse);
    },
    downloadAttestation: (submissionId) => transport.blob(`/insurance-submissions/${segment(submissionId)}/download`, FILE_TYPES),
  };
}
