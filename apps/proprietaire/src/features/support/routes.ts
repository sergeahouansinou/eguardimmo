import type { AccessRoutes, SupportRoutes } from "@eguardimmo/messagerie";

export const bailleurSupportRoutes: SupportRoutes = {
  board: "/support",
  newRequest: "/support/nouvelle",
  ticket: (id) => `/support/${id}`,
};

export const bailleurSupportAccessRoutes: AccessRoutes = { access: "/reglages/acces-support" };
