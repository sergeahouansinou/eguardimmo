import type { ApiClient } from '@eguardimmo/api';
import { fetchAttachment } from '../../external/api/transport';
import type { CampaignDraftInput, CampaignListQuery, CampaignTestInput } from '../model';
import { ALL_BUILDINGS } from '../model';

const segment = encodeURIComponent;

export interface CampaignsTransport {
  list: (query: CampaignListQuery, cursor: string | null) => Promise<unknown>;
  audiences: () => Promise<unknown>;
  show: (id: string) => Promise<unknown>;
  create: (input: CampaignDraftInput) => Promise<unknown>;
  update: (id: string, input: CampaignDraftInput, lockVersion: number) => Promise<unknown>;
  send: (id: string) => Promise<unknown>;
  schedule: (id: string, scheduledAt: string) => Promise<unknown>;
  cancel: (id: string) => Promise<unknown>;
  upload: (id: string, file: File) => Promise<unknown>;
  remove: (id: string, attachmentId: string) => Promise<unknown>;
  download: (id: string, attachmentId: string) => Promise<Blob>;
  test: (input: CampaignTestInput) => Promise<unknown>;
}

function draftBody(input: CampaignDraftInput): Record<string, unknown> {
  return {
    subject: input.subject,
    body: input.body,
    audience: input.audience,
    building_ids: input.buildingIds,
    copy_to_history: input.copyToHistory,
  };
}

export function createCampaignsTransport(client: ApiClient, organizationId: string, fetchImpl: typeof fetch): CampaignsTransport {
  const root = `/api/v1/org/${segment(organizationId)}/campaigns`;
  const one = (id: string) => `${root}/${segment(id)}`;
  return {
    list: (query, cursor) =>
      client.get(root, {
        per_page: query.perPage,
        cursor,
        status: query.tab === 'all' ? undefined : query.tab,
        search: query.search.trim(),
        building: query.building === ALL_BUILDINGS ? undefined : query.building,
        period: query.period === 'all' ? undefined : query.period,
      }),
    audiences: () => client.get(`${root}/audiences`),
    show: (id) => client.get(one(id)),
    create: (input) => client.post(root, draftBody(input)),
    update: (id, input, lockVersion) => client.patch(one(id), { ...draftBody(input), lock_version: lockVersion }),
    send: (id) => client.post(`${one(id)}/send`, {}),
    schedule: (id, scheduledAt) => client.post(`${one(id)}/schedule`, { scheduled_at: scheduledAt }),
    cancel: (id) => client.post(`${one(id)}/cancel`, {}),
    upload: (id, file) => {
      const form = new FormData();
      form.append('file', file);
      return client.post(`${one(id)}/attachments`, form);
    },
    remove: (id, attachmentId) => client.delete(`${one(id)}/attachments/${segment(attachmentId)}`),
    download: (id, attachmentId) => fetchAttachment(client, fetchImpl, `${one(id)}/attachments/${segment(attachmentId)}`),
    test: (input) => client.post(`${root}/test`, { subject: input.subject, body: input.body, audience: input.audience }),
  };
}
