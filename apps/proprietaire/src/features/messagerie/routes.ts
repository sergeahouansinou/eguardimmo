import type { MessagerieRoutes } from "@eguardimmo/messagerie";
import { CONFIE_BASE } from "@/features/confie/routes";

export const bailleurMessagerieRoutes: MessagerieRoutes = {
  inbox: "/messages",
  conversation: (id) => `/messages/${id}`,
  newMessage: "/messages/nouveau",
  campaigns: "/campagnes",
  newCampaign: "/campagnes/nouvelle",
  editCampaign: (id) => `/campagnes/${id}/modifier`,
  help: "/aide",
  supportBoard: "/aide",
  ticket: () => "/aide",
};

export const confieMessagerieRoutes: MessagerieRoutes = {
  inbox: `${CONFIE_BASE}/messages`,
  conversation: (id) => `${CONFIE_BASE}/messages/${id}`,
  newMessage: `${CONFIE_BASE}/messages/nouveau`,
  campaigns: `${CONFIE_BASE}/messages`,
  newCampaign: `${CONFIE_BASE}/messages`,
  editCampaign: () => `${CONFIE_BASE}/messages`,
  help: `${CONFIE_BASE}/aide`,
  supportBoard: `${CONFIE_BASE}/aide`,
  ticket: () => `${CONFIE_BASE}/aide`,
};

export function confieHref(href: string): string {
  return href === CONFIE_BASE || href.startsWith(`${CONFIE_BASE}/`) ? href : `${CONFIE_BASE}${href}`;
}
