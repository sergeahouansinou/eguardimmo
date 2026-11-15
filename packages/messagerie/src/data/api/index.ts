import { isSupportOnline } from '../../lib/hours';
import { demoSeeds } from '../demo';
import type { MessagerieSeed } from '../seed';
import type { MessagerieSource } from '../source';
import { conversationHandlers } from './conversations';
import { ticketHandlers } from './tickets';
import { unavailable } from './shared';
import type { ApiMessagerieSourceOptions } from './shared';

export type { ApiMessagerieSourceOptions } from './shared';

export const CAMPAIGNS_UNAVAILABLE_MESSAGE = 'Les campagnes ne sont pas encore disponibles.';

export interface ApiMessagerieSourceDependencies {
  now?: () => Date;
}

export function createApiMessagerieSource(
  options: ApiMessagerieSourceOptions,
  { now = () => new Date() }: ApiMessagerieSourceDependencies = {},
): MessagerieSource {
  let editorial: MessagerieSeed | null = null;
  const editorialContent = () => {
    editorial ??= demoSeeds[options.space]();
    return editorial;
  };
  const campaignsUnavailable = unavailable(CAMPAIGNS_UNAVAILABLE_MESSAGE);

  return {
    ...conversationHandlers(options),
    ...ticketHandlers(options),
    listCampaigns: campaignsUnavailable,
    getCampaign: campaignsUnavailable,
    listCampaignAudiences: campaignsUnavailable,
    saveCampaign: campaignsUnavailable,
    sendCampaignTest: campaignsUnavailable,
    supportStatus: () => {
      const { hoursLabel, responseLabel } = editorialContent().support;
      return Promise.resolve({ online: isSupportOnline(now()), hoursLabel, responseLabel });
    },
    helpCenter: () => Promise.resolve(editorialContent().help),
  };
}
