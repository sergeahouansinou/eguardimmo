import type { MessagerieRoutes } from "@eguardimmo/messagerie";

export const messagerieRoutes: MessagerieRoutes = {
  inbox: "/messages",
  conversation: (id) => `/messages/${id}`,
  newMessage: "/messages/nouveau",
  campaigns: "/messages",
  newCampaign: "/messages",
  editCampaign: () => "/messages",
  help: "/aide",
  supportBoard: "/messages",
  ticket: () => "/messages",
};
