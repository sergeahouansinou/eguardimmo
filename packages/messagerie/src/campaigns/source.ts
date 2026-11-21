import type {
  AudienceOption,
  Campaign,
  CampaignAttachment,
  CampaignDraftInput,
  CampaignListQuery,
  CampaignPage,
  CampaignTestInput,
  CampaignTestResult,
} from './model';

export interface CampaignsSource {
  list: (query: CampaignListQuery, cursor: string | null) => Promise<CampaignPage>;
  audiences: () => Promise<AudienceOption[]>;
  get: (id: string) => Promise<Campaign>;
  create: (input: CampaignDraftInput) => Promise<Campaign>;
  update: (id: string, input: CampaignDraftInput, lockVersion: number) => Promise<Campaign>;
  send: (id: string) => Promise<Campaign>;
  schedule: (id: string, scheduledAt: string) => Promise<Campaign>;
  cancel: (id: string) => Promise<Campaign>;
  addAttachment: (id: string, file: File) => Promise<CampaignAttachment>;
  removeAttachment: (id: string, attachmentId: string) => Promise<void>;
  downloadAttachment: (id: string, attachment: Pick<CampaignAttachment, 'id' | 'name'>) => Promise<void>;
  sendTest: (input: CampaignTestInput) => Promise<CampaignTestResult>;
}
