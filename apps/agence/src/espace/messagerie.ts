import type { MessagerieRoutes, StaffRoutes } from "@eguardimmo/messagerie";
import { agenceRoutes as r, campagneEditHref } from "./routes";

export const messagerieRoutes: MessagerieRoutes = {
  inbox: r.messages,
  conversation: (id) => `${r.messages}/${id}`,
  newMessage: r.messageNew,
  campaigns: r.campagnes,
  newCampaign: r.campagneNew,
  editCampaign: campagneEditHref,
  help: r.aide,
  supportBoard: r.aide,
  ticket: () => r.aide,
};

export const apiMessagerieRoutes: MessagerieRoutes = { ...messagerieRoutes, inbox: r.messagesTeam };

export const staffMessagerieRoutes: StaffRoutes = {
  section: (section) => (section === "tenant" ? r.messages : section === "owner" ? `${r.messages}?section=mandants` : r.messagesTeam),
  thread: (id) => `${r.messages}/fil/${id}`,
};
