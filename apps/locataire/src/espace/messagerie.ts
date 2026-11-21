import type { ExternalRoutes, MessagerieRoutes } from "@eguardimmo/messagerie";

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

export const externalMessagerieRoutes: ExternalRoutes = {
  inbox: "/messages",
  thread: (id) => `/messages/${id}`,
  newThread: "/messages/nouveau",
};
