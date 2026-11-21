import type { ApiClient } from '@eguardimmo/api';
import { saveBlob } from '../../data/api/attachmentDownload';
import { parsePayload, safeFileName } from '../../external/api/transport';
import type { CampaignsSource } from '../source';
import { toAttachment, toAudiences, toCampaign, toCampaignPage, toTestResult } from './mapping';
import { attachmentPayload, audiencesPayload, campaignListPayload, campaignPayload, testPayload } from './payloads';
import { createCampaignsTransport } from './transport';

export interface CampaignsApiSourceOptions {
  client: ApiClient;
  organizationId: string;
  fetchImpl?: typeof fetch;
}

export function createCampaignsApiSource({ client, organizationId, fetchImpl = (...args) => fetch(...args) }: CampaignsApiSourceOptions): CampaignsSource {
  const transport = createCampaignsTransport(client, organizationId, fetchImpl);
  const one = async (request: Promise<unknown>) => toCampaign(parsePayload(campaignPayload, await request).data);
  return {
    list: async (query, cursor) => toCampaignPage(parsePayload(campaignListPayload, await transport.list(query, cursor))),
    audiences: async () => toAudiences(parsePayload(audiencesPayload, await transport.audiences())),
    get: (id) => one(transport.show(id)),
    create: (input) => one(transport.create(input)),
    update: (id, input, lockVersion) => one(transport.update(id, input, lockVersion)),
    send: (id) => one(transport.send(id)),
    schedule: (id, scheduledAt) => one(transport.schedule(id, scheduledAt)),
    cancel: (id) => one(transport.cancel(id)),
    addAttachment: async (id, file) => toAttachment(parsePayload(attachmentPayload, await transport.upload(id, file)).data),
    removeAttachment: async (id, attachmentId) => {
      await transport.remove(id, attachmentId);
    },
    downloadAttachment: async (id, attachment) => {
      saveBlob(await transport.download(id, attachment.id), safeFileName(attachment.name));
    },
    sendTest: async (input) => toTestResult(parsePayload(testPayload, await transport.test(input))),
  };
}
