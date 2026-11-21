import type { ApiClient } from '@eguardimmo/api';
import { fetchBlob } from './blobRequests';
import { toChargeStatement } from './chargeMapping';
import type { ChargeStatement } from './chargeModel';
import { chargeStatementPageSchema, chargeStatementSchema } from './chargeSchemas';
import { parse } from './requests';
import type { CursorPage } from './rentModel';

export const CHARGES_PATH = '/api/v1/tenant/charge-statements';
const segment = encodeURIComponent;

export const CHARGE_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

export async function fetchChargeStatementsPage(client: ApiClient, leaseId: string | null, cursor: string | null): Promise<CursorPage<ChargeStatement>> {
  const page = parse(chargeStatementPageSchema, await client.get(CHARGES_PATH, { lease: leaseId, cursor }));
  return { items: page.data.map(toChargeStatement), nextCursor: page.next_cursor };
}

export async function fetchChargeStatement(client: ApiClient, id: string): Promise<ChargeStatement> {
  return toChargeStatement(parse(chargeStatementSchema, await client.get(`${CHARGES_PATH}/${segment(id)}`)).data);
}

export const chargePdfPath = (statementId: string): string => `${CHARGES_PATH}/${segment(statementId)}/pdf`;
export const chargeFilePath = (statementId: string, fileId: string): string => `${CHARGES_PATH}/${segment(statementId)}/files/${segment(fileId)}`;

export function fetchChargePdf(client: ApiClient, path: string, fetchImpl?: typeof fetch): Promise<Blob> {
  return fetchBlob(client, path, ['application/pdf'], fetchImpl);
}

export function fetchChargeFile(client: ApiClient, path: string, fetchImpl?: typeof fetch): Promise<Blob> {
  return fetchBlob(client, path, CHARGE_FILE_TYPES, fetchImpl);
}
