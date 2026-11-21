"use client";

import { CampaignDetailPage, CampaignEditorPage, CampaignsListPage } from "@eguardimmo/messagerie";

export function ApiCampaignsList() {
  return <CampaignsListPage />;
}

export function ApiCampaignEditor({ id }: { id?: string }) {
  return <CampaignEditorPage campaignId={id ?? null} />;
}

export function ApiCampaignDetail({ id }: { id: string }) {
  return <CampaignDetailPage campaignId={id} />;
}
