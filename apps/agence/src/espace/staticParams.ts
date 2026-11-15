import { demoSeeds } from "@eguardimmo/messagerie";

export function conversationIds(): { id: string }[] {
  return demoSeeds.agence().conversations.map((item) => ({ id: item.id }));
}

export function campaignIds(): { id: string }[] {
  return demoSeeds.agence().campaigns.map((item) => ({ id: item.id }));
}
