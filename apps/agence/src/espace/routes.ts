export const agenceRoutes = {
  home: "/",
  mandants: "/mandants",
  mandantNew: "/mandants/nouveau",
  mandats: "/mandats",
  mandatNew: "/mandats/nouveau",
  mandatAvenant: "/mandats/avenant",
  biens: "/biens",
  bienNew: "/biens/nouveau",
  locataires: "/locataires",
  locataireInvitation: "/locataires/invitation",
  baux: "/baux",
  bailNew: "/baux/nouveau",
  avisEcheance: "/baux/avis-echeance",
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
  notifications: "/notifications",
  locataireNew: "/locataires/nouveau",
  candidats: "/locataires/candidats",
  candidatInvitation: "/locataires/candidats/inviter",
  etatsLieux: "/baux/etats-des-lieux",
  etatLieuxNew: "/baux/etats-des-lieux/nouveau",
  reservations: "/baux/reservations",
  reservationNew: "/baux/reservations/nouvelle",
  immeubles: "/biens/immeubles",
  immeubleNew: "/biens/immeubles/nouveau",
  equipements: "/biens/equipements",
  equipementNew: "/biens/equipements/nouveau",
  releves: "/biens/releves",
  inventaires: "/biens/inventaires",
  equipeInviter: "/equipe/inviter",
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

export function bailNewHref(bienId: string): string {
  return `${agenceRoutes.bailNew}?bien=${encodeURIComponent(bienId)}`;
}

export function mandatAvenantHref(mandatId: string): string {
  return `${agenceRoutes.mandatAvenant}?mandat=${encodeURIComponent(mandatId)}`;
}

export function locataireInvitationHref(bailId: string): string {
  return `${agenceRoutes.locataireInvitation}?bail=${encodeURIComponent(bailId)}`;
}

export function avisEcheanceHref(bailId: string, month?: string): string {
  const params = new URLSearchParams({ bail: bailId });
  if (month) params.set("mois", month);
  return `${agenceRoutes.avisEcheance}?${params.toString()}`;
}
