import { ApiUnreachableError, toApiError } from '@eguardimmo/api';
import type { ApiClient } from '@eguardimmo/api';
import { UnexpectedResponseError } from './errors';
import { toIntervention } from './interventionMapping';
import type { LeaseReportOptions, ReportInput, TenantIntervention, VisitSlot } from './interventionModel';
import { interventionPageSchema, interventionSchema, optionsSchema } from './interventionSchemas';
import { parse } from './requests';
import type { CursorPage } from './rentModel';

export const INTERVENTIONS_PATH = '/api/v1/tenant/interventions';
export const OPTIONS_PATH = '/api/v1/tenant/interventions/options';
const segment = encodeURIComponent;
const one = (path: string): string => `${INTERVENTIONS_PATH}/${path}`;

export async function fetchInterventionsPage(client: ApiClient, cursor: string | null): Promise<CursorPage<TenantIntervention>> {
  const page = parse(interventionPageSchema, await client.get(INTERVENTIONS_PATH, { cursor }));
  return { items: page.data.map(toIntervention), nextCursor: page.meta.next_cursor };
}

export async function fetchIntervention(client: ApiClient, id: string): Promise<TenantIntervention> {
  return toIntervention(parse(interventionSchema, await client.get(one(segment(id)))).data);
}

export async function fetchReportOptions(client: ApiClient): Promise<LeaseReportOptions[]> {
  return parse(optionsSchema, await client.get(OPTIONS_PATH)).data.map((lease) => ({
    leaseId: lease.lease_id,
    label: lease.label,
    units: lease.units,
    commonAreaAllowed: lease.common_area_allowed,
    natures: lease.natures,
  }));
}

export async function reportIntervention(client: ApiClient, input: ReportInput): Promise<TenantIntervention> {
  const body = {
    lease_id: input.leaseId,
    unit_id: input.unitId,
    common_area: input.commonArea,
    nature_term_id: input.natureTermId,
    title: input.title.trim(),
    description: input.description.trim(),
    room: input.room.trim() === '' ? null : input.room.trim(),
    reported_urgency: input.reportedUrgency,
    availability: input.availability.trim() === '' ? null : input.availability.trim(),
  };
  const response = await client.post(INTERVENTIONS_PATH, body, { headers: { 'Idempotency-Key': input.idempotencyKey } });
  return toIntervention(parse(interventionSchema, response).data);
}

export async function uploadPhoto(client: ApiClient, id: string, file: File): Promise<void> {
  const form = new FormData();
  form.append('file', file);
  parse(interventionSchema, await client.post(one(`${segment(id)}/files`), form));
}

export async function postComment(client: ApiClient, id: string, text: string): Promise<void> {
  parse(interventionSchema, await client.post(one(`${segment(id)}/comments`), { text: text.trim() }));
}

export async function cancelIntervention(client: ApiClient, id: string): Promise<TenantIntervention> {
  return toIntervention(parse(interventionSchema, await client.post(one(`${segment(id)}/cancel`))).data);
}

export async function confirmVisit(client: ApiClient, id: string, visitId: string): Promise<TenantIntervention> {
  return toIntervention(parse(interventionSchema, await client.post(one(`${segment(id)}/visits/${segment(visitId)}/confirm`))).data);
}

export async function requestReschedule(client: ApiClient, id: string, visitId: string, request: { requestedOn: string; slot: VisitSlot }): Promise<TenantIntervention> {
  const body = { requested_on: request.requestedOn, slot: request.slot };
  return toIntervention(parse(interventionSchema, await client.post(one(`${segment(id)}/visits/${segment(visitId)}/reschedule-request`), body)).data);
}

export const photoPath = (id: string, fileId: string): string => one(`${segment(id)}/files/${segment(fileId)}`);

export async function fetchPhoto(client: ApiClient, path: string, fetchImpl: typeof fetch = (...args) => fetch(...args)): Promise<Blob> {
  let response: Response;
  try {
    response = await fetchImpl(client.url(path), { credentials: 'include', headers: { Accept: 'image/*', 'X-Requested-With': 'XMLHttpRequest' } });
  } catch {
    throw new ApiUnreachableError();
  }
  if (!response.ok) throw await toApiError(response);
  if (!(response.headers.get('Content-Type') ?? '').startsWith('image/')) throw new UnexpectedResponseError();
  return response.blob();
}
