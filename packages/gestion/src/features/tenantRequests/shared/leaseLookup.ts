'use client';

import type { ApiClient } from '@eguardimmo/api';
import { z } from 'zod';
import { MissingSourceError, createSourceContext } from '../../locataires/kit/sourceContext';
import { id, isoDate, pageOf } from './schemas';
import { createTransport } from './transport';

export interface LeaseSummaryView {
  id: string;
  reference: string;
  phase: string;
  property: string | null;
  unit: string | null;
  tenants: { partyId: string; name: string }[];
}

export interface LeaseParticipant {
  linkId: string;
  partyId: string;
  name: string;
  role: string;
  endDate: string | null;
}

export interface LeaseDetailView extends LeaseSummaryView {
  status: string;
  lockVersion: number;
  noticeReceivedOn: string | null;
  participants: LeaseParticipant[];
}

export interface LeaseLookupSource {
  lease: (leaseId: string) => Promise<LeaseDetailView>;
  search: (query: string) => Promise<LeaseSummaryView[]>;
}

const partySchema = z.object({ id, display_name: z.string(), kind: z.string(), is_anonymized: z.boolean() });
const unitSchema = z.object({ id, reference: z.string(), property: z.object({ id, name: z.string() }) });

const summarySchema = z.object({
  id,
  reference: z.string(),
  phase: z.string(),
  status: z.string(),
  main_unit: unitSchema.nullable(),
  tenants: z.array(partySchema),
  lock_version: z.number().int().positive(),
});

const detailSchema = summarySchema.extend({
  notice: z.object({ received_on: isoDate }).nullable(),
  parties: z.array(z.object({ id, party: partySchema, role: z.string(), end_date: isoDate.nullable() })),
});

const pageSchema = pageOf(summarySchema);
const detailResponse = z.object({ data: detailSchema });

type SummaryRow = z.infer<typeof summarySchema>;

const toSummary = (row: SummaryRow): LeaseSummaryView => ({
  id: row.id,
  reference: row.reference,
  phase: row.phase,
  property: row.main_unit?.property.name ?? null,
  unit: row.main_unit?.reference ?? null,
  tenants: row.tenants.map((tenant) => ({ partyId: tenant.id, name: tenant.display_name })),
});

export function createApiLeaseLookup(client: ApiClient, organizationId: string | null, fetchImpl?: typeof fetch): LeaseLookupSource {
  const transport = createTransport(client, organizationId, fetchImpl);
  return {
    lease: async (leaseId) => {
      const row = (await transport.get(`/leases/${encodeURIComponent(leaseId)}`, detailResponse)).data;
      return {
        ...toSummary(row),
        status: row.status,
        lockVersion: row.lock_version,
        noticeReceivedOn: row.notice?.received_on ?? null,
        participants: row.parties.map((link) => ({ linkId: link.id, partyId: link.party.id, name: link.party.display_name, role: link.role, endDate: link.end_date })),
      };
    },
    search: async (query) => (await transport.get('/leases', pageSchema, { per_page: 50, q: query === '' ? undefined : query })).data.map(toSummary),
  };
}

const context = createSourceContext<LeaseLookupSource>('Baux', () => {
  throw new MissingSourceError('Baux');
});

export const LeaseLookupProvider = context.SourceProvider;
export const useLeaseLookup = context.useSource;
