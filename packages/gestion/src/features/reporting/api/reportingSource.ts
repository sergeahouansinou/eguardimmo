import type { ApiClient } from '@eguardimmo/api';
import { z } from 'zod';
import type { MandantOption } from '../model';
import { reportingPermissions } from '../permissions';
import type { ReportingOrganizationKind, ReportingRole } from '../permissions';
import type { ReportingSource } from '../source';
import { toAgencyKpis, toAging, toAlerts, toLandlordHome, toOutcome, toPayouts, toReport, toStatement } from './reportingMapping';
import { createPayload, monthOf, rangeOf, reasonOf, scheduledFor, updatePayload } from './reportingPayloads';
import {
  apiAgencyKpisSchema,
  apiAgingSchema,
  apiAlertsSchema,
  apiCreateResponse,
  apiLandlordSchema,
  apiMandantPage,
  apiPartyResponse,
  apiPayoutsSchema,
  apiReportPage,
  apiReportResponse,
  apiStatementSchema,
} from './reportingSchemas';
import { createReportingTransport } from './reportingTransport';

export interface ApiReportingSourceOptions {
  client: ApiClient;
  organizationId: string | null;
  role: ReportingRole | null;
  kind: ReportingOrganizationKind | null;
}

export interface ApiReportingSourceDependencies {
  fetchImpl?: typeof fetch;
  readCookie?: (name: string) => string | null;
}

const PAGE_SIZE = 25;
const MANDANT_PAGE = 200;
const MANDANT_PAGES_MAX = 10;
const segment = (id: string): string => encodeURIComponent(id);
const reports = (path = ''): string => `/management-reports${path}`;

export function createApiReportingSource(
  { client, organizationId, role, kind }: ApiReportingSourceOptions,
  { fetchImpl, readCookie }: ApiReportingSourceDependencies = {},
): ReportingSource {
  const transport = createReportingTransport(client, organizationId, fetchImpl, readCookie);
  const report = async (request: Promise<z.infer<typeof apiReportResponse>>) => toReport((await request).data);
  const statementQuery = (from: string, to: string) => rangeOf(from, to);

  return {
    permissions: reportingPermissions(role, kind),
    agencyKpis: async (month) => toAgencyKpis((await transport.get('/home/agency-kpis', z.object({ data: apiAgencyKpisSchema }), { month: month === undefined ? undefined : monthOf(month) })).data),
    agencyPayouts: async () => toPayouts((await transport.get('/home/agency-payouts', z.object({ data: apiPayoutsSchema }))).data),
    agencyAlerts: async () => toAlerts((await transport.get('/home/agency-alerts', z.object({ data: apiAlertsSchema }))).data),
    landlordHome: async (month) => toLandlordHome((await transport.get('/home/landlord', z.object({ data: apiLandlordSchema }), { month: month === undefined ? undefined : monthOf(month) })).data),
    aging: async () => toAging((await transport.get('/finance/aging', z.object({ data: apiAgingSchema }))).data),
    reports: async (query) => {
      const page = await transport.get(reports(), apiReportPage, { per_page: PAGE_SIZE, cursor: query.cursor, status: query.status, mandant: query.mandantId });
      return {
        items: page.data.map(toReport),
        nextCursor: page.meta.next_cursor,
        due: page.meta.due === undefined ? null : { period: page.meta.due.period, mandants: page.meta.due.mandants.map((mandant) => ({ partyId: mandant.party_id, name: mandant.name })) },
      };
    },
    report: (id) => report(transport.get(reports(`/${segment(id)}`), apiReportResponse)),
    mandants: async () => {
      const all: MandantOption[] = [];
      let after: string | undefined;
      for (let page = 0; page < MANDANT_PAGES_MAX; page += 1) {
        const { data } = await transport.getOrg('/mandates/mandants', apiMandantPage, { limit: MANDANT_PAGE, after });
        all.push(...data.map((mandant) => ({ partyId: mandant.party_id, name: mandant.display_name })));
        const last = data.at(-1);
        if (data.length < MANDANT_PAGE || last === undefined) return all;
        after = last.party_id;
      }
      return all;
    },
    partyName: async (partyId) => {
      const party = (await transport.getOrg(`/parties/${segment(partyId)}`, apiPartyResponse)).data;
      return party.is_anonymized ? null : party.display_name;
    },
    createReports: async (input, key) => (await transport.postKeyed(reports(), apiCreateResponse, key, createPayload(input))).data.map(toOutcome),
    updateReport: async (id, lockVersion, changes) => await report(transport.patch(reports(`/${segment(id)}`), apiReportResponse, updatePayload(lockVersion, changes))),
    generateReport: (id) => report(transport.post(reports(`/${segment(id)}/generate`), apiReportResponse)),
    discardReport: (id) => report(transport.post(reports(`/${segment(id)}/discard`), apiReportResponse)),
    publishReport: (id) => report(transport.post(reports(`/${segment(id)}/publish`), apiReportResponse)),
    scheduleReport: async (id, at) => await report(transport.post(reports(`/${segment(id)}/publish`), apiReportResponse, { scheduled_for: scheduledFor(at) })),
    unscheduleReport: (id) => report(transport.remove(reports(`/${segment(id)}/schedule`), apiReportResponse)),
    rectifyReport: async (id, reason) => await report(transport.post(reports(`/${segment(id)}/rectify`), apiReportResponse, { reason: reasonOf(reason) })),
    pdf: (id) => transport.file(reports(`/${segment(id)}/pdf`), 'application/pdf'),
    linesCsv: (id) => transport.file(reports(`/${segment(id)}/lines.csv`), 'text/csv'),
    statement: async (mandantId, from, to) => toStatement((await transport.get(`/mandants/${segment(mandantId)}/statement`, z.object({ data: apiStatementSchema }), { ...statementQuery(from, to), format: 'json' })).data),
    statementCsv: (mandantId, from, to) => transport.file(`/mandants/${segment(mandantId)}/statement`, 'text/csv', { ...statementQuery(from, to), format: 'csv' }),
  };
}
