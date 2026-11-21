import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { toAudiences, toCampaign, toCampaignPage } from '../src/campaigns/api/mapping';
import { CampaignsProvider } from '../src/campaigns/context';
import type { CampaignsRoutes } from '../src/campaigns/context';
import type { AudienceOption, Campaign, CampaignPage } from '../src/campaigns/model';
import type { CampaignsSource } from '../src/campaigns/source';
import { audiencesResponse, campaignFixture, campaignListResponse } from '../src/campaigns/testing';
import type { CampaignFixture } from '../src/campaigns/testing';
import type { OrganizationKind, StaffRole } from '../src/external/staff/model';
import { TestLink } from './render';
import { proofStub } from './staff';
import type { ProofStub } from './staff';

export const campaignRoutes: CampaignsRoutes = {
  list: '/campagnes',
  newCampaign: '/campagnes/nouvelle',
  detail: (id) => `/campagnes/${id}`,
  edit: (id) => `/campagnes/${id}/modifier`,
  messages: '/messages',
};

export const campaignOf = (overrides: Partial<CampaignFixture> = {}): Campaign => toCampaign(campaignFixture(overrides));
export const campaignPageOf = (items: CampaignFixture[], extra: Parameters<typeof campaignListResponse>[1] = {}): CampaignPage =>
  toCampaignPage(campaignListResponse(items, extra));
export const audiencesOf = (mandants = true): AudienceOption[] => toAudiences(audiencesResponse(mandants));

type SourceMocks = { [K in keyof CampaignsSource]: ReturnType<typeof vi.fn<CampaignsSource[K]>> };

export function fakeCampaigns(overrides: Partial<CampaignsSource> = {}): SourceMocks {
  const base: CampaignsSource = {
    list: () => Promise.resolve(campaignPageOf([])),
    audiences: () => Promise.resolve(audiencesOf()),
    get: () => Promise.resolve(campaignOf()),
    create: () => Promise.resolve(campaignOf()),
    update: () => Promise.resolve(campaignOf({ lock_version: 2 })),
    send: () => Promise.resolve(campaignOf({ status: 'sending', lock_version: 3 })),
    schedule: () => Promise.resolve(campaignOf({ status: 'scheduled', scheduled_at: '2026-11-20T09:00:00+00:00', lock_version: 3 })),
    cancel: () => Promise.resolve(campaignOf({ status: 'cancelled', cancelled_at: '2026-11-19T10:00:00+00:00', lock_version: 3 })),
    addAttachment: () => Promise.resolve({ id: 'a1', name: 'avis.pdf', sizeBytes: 2048 }),
    removeAttachment: () => Promise.resolve(),
    downloadAttachment: () => Promise.resolve(),
    sendTest: () => Promise.resolve({ sentTo: 'jeanne@example.com', subject: 'Coupure d’eau lundi', sentAt: '2026-11-19T10:00:00+00:00' }),
    ...overrides,
  };
  return {
    list: vi.fn(base.list),
    audiences: vi.fn(base.audiences),
    get: vi.fn(base.get),
    create: vi.fn(base.create),
    update: vi.fn(base.update),
    send: vi.fn(base.send),
    schedule: vi.fn(base.schedule),
    cancel: vi.fn(base.cancel),
    addAttachment: vi.fn(base.addAttachment),
    removeAttachment: vi.fn(base.removeAttachment),
    downloadAttachment: vi.fn(base.downloadAttachment),
    sendTest: vi.fn(base.sendTest),
  };
}

export interface RenderCampaignsOptions {
  source?: CampaignsSource;
  role?: StaffRole;
  organizationKind?: OrganizationKind;
  proof?: ProofStub;
  now?: () => Date;
}

export const FIXED_NOW = new Date('2026-11-19T09:10:00+00:00');

export function renderCampaigns(
  ui: ReactElement,
  { source = fakeCampaigns(), role = 'admin', organizationKind = 'agency', proof = proofStub(), now = () => FIXED_NOW }: RenderCampaignsOptions = {},
) {
  const navigate = vi.fn<(href: string) => void>();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <CampaignsProvider
        source={source}
        routes={campaignRoutes}
        Link={TestLink}
        navigate={navigate}
        role={role}
        organizationKind={organizationKind}
        useProof={proof.hook}
        senderName="Agence des Tilleuls"
        now={now}
      >
        {ui}
      </CampaignsProvider>
    </QueryClientProvider>,
  );
  return { ...view, navigate, client, proof };
}
