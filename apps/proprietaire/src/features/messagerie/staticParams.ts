import { demoSeeds } from "@eguardimmo/messagerie";

export type SeededSpace = "bailleur" | "proprietaire";

export function conversationIds(space: SeededSpace): { id: string }[] {
  return demoSeeds[space]().conversations.map((item) => ({ id: item.id }));
}

export function campaignIds(space: SeededSpace): { id: string }[] {
  return demoSeeds[space]().campaigns.map((item) => ({ id: item.id }));
}
