export const agenceRoutes = {
  home: "/",
  mandants: "/mandants",
  mandantNew: "/mandants/nouveau",
  mandats: "/mandats",
  mandatNew: "/mandats/nouveau",
  biens: "/biens",
  locataires: "/locataires",
  baux: "/baux",
  bailNew: "/baux/nouveau",
  encaissements: "/finances/encaissements",
  encaissementNew: "/finances/encaissements/nouveau",
  impayes: "/finances/impayes",
  reversements: "/finances/reversements",
  reversementLot: "/finances/reversements/lot",
  honoraires: "/finances/honoraires",
  honorairesBareme: "/finances/honoraires/bareme",
  comptesRendus: "/comptes-rendus",
  comptesRendusNew: "/comptes-rendus/nouveau",
  messages: "/messages",
  messageNew: "/messages/nouveau",
  campagnes: "/campagnes",
  campagneNew: "/campagnes/nouvelle",
  devis: "/devis",
  interventions: "/interventions",
  interventionNew: "/interventions/nouvelle",
  conformite: "/conformite",
  documents: "/documents",
  documentAdd: "/documents/ajout",
  reglages: "/reglages",
  reglagesFinances: "/reglages/finances",
  equipe: "/equipe",
  equipeInvitation: "/equipe/invitation",
  equipeRoles: "/equipe/roles",
  compte: "/compte",
  compteSecurite: "/compte/securite",
  compteNotifications: "/compte/notifications",
  compteAbonnement: "/compte/abonnement",
  aide: "/aide",
  profiles: "/choix-du-profil",
  notifications: "/notifications",
  signOut: "/deconnexion",
} as const;

export function mandantHref(id: string): string {
  return `${agenceRoutes.mandants}/${id}`;
}

export function mandatHref(id: string): string {
  return `${agenceRoutes.mandats}/${id}`;
}

export function mandatTerminationHref(id: string): string {
  return `${agenceRoutes.mandats}/${id}/resiliation`;
}

export function bienHref(id: string): string {
  return `${agenceRoutes.biens}/${id}`;
}

export function locataireHref(id: string): string {
  return `${agenceRoutes.locataires}/${id}`;
}

export function bailHref(id: string): string {
  return `${agenceRoutes.baux}/${id}`;
}

export function campagneEditHref(id: string): string {
  return `${agenceRoutes.campagnes}/${id}/modifier`;
}
