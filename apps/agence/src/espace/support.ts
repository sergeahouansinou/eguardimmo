import type { AccessRoutes, SupportRoutes } from "@eguardimmo/messagerie";
import { agenceRoutes as r } from "./routes";

export const supportRoutes: SupportRoutes = {
  board: r.support,
  newRequest: r.supportNew,
  ticket: (id) => `${r.support}/${id}`,
};

export const supportAccessRoutes: AccessRoutes = { access: r.reglagesAccesSupport };
