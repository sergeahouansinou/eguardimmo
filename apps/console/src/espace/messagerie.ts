import type { MessagerieRoutes } from '@eguardimmo/messagerie';

export const messagerieRoutes: MessagerieRoutes = {
  inbox: '/support',
  conversation: () => '/support',
  newMessage: '/support',
  campaigns: '/support',
  newCampaign: '/support',
  editCampaign: () => '/support',
  help: '/aide',
  supportBoard: '/support',
  ticket: (id) => `/support/${id}`,
};
