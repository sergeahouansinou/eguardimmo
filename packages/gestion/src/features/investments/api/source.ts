import type { ApiClient } from '@eguardimmo/api';
import type { Currency } from '../../../format/money';
import { createOrgTransport } from '../../orgapi/transport';
import type { InvestmentsSource } from '../source';
import { translateInvestmentsError } from './errors';
import { toAcquisition, toLoan, toSchedule } from './mapping';
import { acquisitionBody, acquisitionUpdateBody, attestationBody, feeBody, loanBody, prepaymentBody, scheduleImportBody } from './payloads';
import { apiAcquisitionList, apiAcquisitionOne, apiAttestationOne, apiFeeOne, apiLoanList, apiLoanOne, apiOrganizationCurrency, apiSchedule } from './schemas';

export interface ApiInvestmentsSourceOptions {
  client: ApiClient;
  organizationId: string | null;
}

const segment = (id: string): string => encodeURIComponent(id);

export function createApiInvestmentsSource({ client, organizationId }: ApiInvestmentsSourceOptions, dependencies: { fetchImpl?: typeof fetch } = {}): InvestmentsSource {
  const transport = createOrgTransport(client, organizationId, translateInvestmentsError, dependencies.fetchImpl);
  const loansPath = (id: string, suffix = ''): string => `/investments/loans/${segment(id)}${suffix}`;

  return {
    currency: async (): Promise<Currency | null> => {
      return (await transport.get('', apiOrganizationCurrency)).data.currency === 'EUR' ? 'EUR' : null;
    },
    loans: async (filters) => (await transport.get('/investments/loans', apiLoanList, { property_id: filters.propertyId, status: filters.status })).data.map(toLoan),
    loan: async (id) => toLoan((await transport.get(loansPath(id), apiLoanOne)).data),
    schedule: async (id) => toSchedule((await transport.get(loansPath(id, '/schedule'), apiSchedule)).data),
    createLoan: async (input, key) => toLoan((await transport.post('/investments/loans', apiLoanOne, { body: loanBody(input), key })).data),
    prepay: async (id, input) => toLoan((await transport.post(loansPath(id, '/prepayments'), apiLoanOne, { body: prepaymentBody(input) })).data),
    importSchedule: async (id, file, lockVersion) => toLoan((await transport.post(loansPath(id, '/schedule/import'), apiLoanOne, { body: scheduleImportBody(file, lockVersion) })).data),
    addFee: async (id, input) => {
      await transport.post(loansPath(id, '/fees'), apiFeeOne, { body: feeBody(input) });
    },
    addAttestation: async (id, input) => {
      await transport.post(loansPath(id, '/attestations'), apiAttestationOne, { body: attestationBody(input) });
    },
    voidLoan: async (id, reason, lockVersion) => toLoan((await transport.post(loansPath(id, '/void'), apiLoanOne, { body: { reason, lock_version: lockVersion } })).data),
    acquisitions: async (propertyId) => (await transport.get('/investments/acquisitions', apiAcquisitionList, { property_id: propertyId })).data.map(toAcquisition),
    createAcquisition: async (input, key) => toAcquisition((await transport.post('/investments/acquisitions', apiAcquisitionOne, { body: acquisitionBody(input), key })).data),
    updateAcquisition: async (id, input) => toAcquisition((await transport.patch(`/investments/acquisitions/${segment(id)}`, apiAcquisitionOne, acquisitionUpdateBody(input))).data),
  };
}
