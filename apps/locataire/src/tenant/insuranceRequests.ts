import type { ApiClient } from '@eguardimmo/api';
import { insuranceSchema, submissionSchema } from './insuranceSchemas';
import type { Insurance, InsuranceSubmission } from './insuranceSchemas';
import { parse } from './requests';

const segment = encodeURIComponent;

export interface DepositInput {
  leaseId: string;
  insurer: string;
  policyNumber: string;
  startsOn: string;
  endsOn: string;
  file: File;
  clientId: string;
}

export async function fetchInsurance(client: ApiClient, leaseId: string): Promise<Insurance> {
  return parse(insuranceSchema, await client.get(`/api/v1/tenant/leases/${segment(leaseId)}/insurance`)).data;
}

export async function depositAttestation(client: ApiClient, input: DepositInput): Promise<InsuranceSubmission> {
  const form = new FormData();
  form.append('file', input.file);
  form.append('insurer', input.insurer.trim());
  form.append('policy_number', input.policyNumber.trim());
  form.append('starts_on', input.startsOn);
  form.append('ends_on', input.endsOn);
  form.append('client_id', input.clientId);
  return parse(submissionSchema, await client.post(`/api/v1/tenant/leases/${segment(input.leaseId)}/insurance-submissions`, form)).data;
}

export async function withdrawSubmission(client: ApiClient, id: string): Promise<InsuranceSubmission> {
  return parse(submissionSchema, await client.delete(`/api/v1/tenant/insurance-submissions/${segment(id)}`)).data;
}

export const submissionFilePath = (id: string): string => `/api/v1/tenant/insurance-submissions/${segment(id)}/download`;
