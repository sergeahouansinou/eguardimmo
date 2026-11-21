import type { SupportRoutes } from "@eguardimmo/messagerie";

export const supportRoutes: SupportRoutes = {
  board: "/support",
  newRequest: "/support/nouvelle",
  ticket: (id) => `/support/${id}`,
};
