import { agenceSeed } from './fixtures/agence';
import { bailleurSeed } from './fixtures/bailleur';
import { consoleSeed } from './fixtures/console';
import { locataireSeed } from './fixtures/locataire';
import { proprietaireSeed } from './fixtures/proprietaire';
import { campaignHandlers } from './demoCampaigns';
import { conversationHandlers } from './demoConversations';
import { createContext, run } from './demoState';
import { ticketHandlers } from './demoTickets';
import type { MessagerieSeed } from './seed';
import type { MessagerieSource } from './source';

export type MessagerieSpace = 'locataire' | 'proprietaire' | 'agence' | 'bailleur' | 'console';

export const demoSeeds: Record<MessagerieSpace, () => MessagerieSeed> = {
  locataire: locataireSeed,
  proprietaire: proprietaireSeed,
  agence: agenceSeed,
  bailleur: bailleurSeed,
  console: consoleSeed,
};

export interface DemoSourceOptions {
  space: MessagerieSpace;
  now?: () => Date;
}

export function createDemoMessagerieSource({ space, now = () => new Date() }: DemoSourceOptions): MessagerieSource {
  const context = createContext(demoSeeds[space](), now);
  return {
    ...conversationHandlers(context),
    ...campaignHandlers(context),
    ...ticketHandlers(context),
    helpCenter: () => run(() => context.state.help),
  };
}
