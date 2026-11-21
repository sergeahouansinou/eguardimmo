import { demoSeeds } from '../demo';
import { supportStatusResponseSchema } from './apiSchemas';
import type { MessagerieSeed } from '../seed';
import type { MessagerieSource } from '../source';
import { conversationHandlers } from './conversations';
import { ticketHandlers } from './tickets';
import { parseResponse, translated, unavailable } from './shared';
import type { ApiMessagerieSourceOptions } from './shared';

export type { ApiMessagerieSourceOptions } from './shared';

export const CAMPAIGNS_UNAVAILABLE_MESSAGE = 'Les campagnes ne sont pas encore disponibles.';

export function createApiMessagerieSource(options: ApiMessagerieSourceOptions): MessagerieSource {
  let editorial: MessagerieSeed | null = null;
  const editorialContent = () => {
    editorial ??= demoSeeds[options.space]();
    return editorial;
  };
  const campaignsUnavailable = unavailable(CAMPAIGNS_UNAVAILABLE_MESSAGE);

  return {
    ...conversationHandlers(options),
    ...ticketHandlers(),
    listCampaigns: campaignsUnavailable,
    getCampaign: campaignsUnavailable,
    listCampaignAudiences: campaignsUnavailable,
    saveCampaign: campaignsUnavailable,
    sendCampaignTest: campaignsUnavailable,
    supportStatus: () =>
      translated(async () => {
        const { data } = parseResponse(supportStatusResponseSchema, await options.client.get('/api/v1/support/status'));
        return { online: data.online, hoursLabel: data.hours_label, responseLabel: data.response_label };
      }),
    helpCenter: () => Promise.resolve(editorialContent().help),
  };
}
