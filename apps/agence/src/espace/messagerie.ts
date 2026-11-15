import type { MessagerieRoutes } from "@eguardimmo/messagerie";
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
