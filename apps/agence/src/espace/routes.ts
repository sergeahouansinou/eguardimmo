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
  reversementsIban: "/finances/reversements/demandes-iban",
  honoraires: "/finances/honoraires",
  honorairesBareme: "/finances/honoraires/bareme",
  fonds: "/finances/fonds",
  depenses: "/finances/depenses",
  depenseNew: "/finances/depenses/nouvelle",
  charges: "/finances/charges",
  chargeNew: "/finances/charges/nouveau",
  chargesCles: "/finances/charges/cles",
  cloture: "/finances/cloture",
  banque: "/finances/banque",
  banqueComptes: "/finances/banque/comptes",
  banqueReleves: "/finances/banque/releves",
  banqueImport: "/finances/banque/import",
  banqueEtats: "/finances/banque/etats",
  comptesRendus: "/comptes-rendus",
  comptesRendusNew: "/comptes-rendus/nouveau",
  comptesRendusReleve: "/comptes-rendus/releve",
  messages: "/messages",
  messageNew: "/messages/nouveau",
  messagesTeam: "/messages/equipe",
  campagnes: "/campagnes",
  campagneNew: "/campagnes/nouvelle",
  devis: "/devis",
  interventions: "/interventions",
  interventionNew: "/interventions/nouvelle",
  interventionSuppliers: "/interventions/prestataires",
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
  support: "/support",
  supportNew: "/support/nouvelle",
  reglagesAccesSupport: "/reglages/acces-support",
  notifications: "/notifications",
  locataireNew: "/locataires/nouveau",
  candidats: "/locataires/candidats",
  candidatInvitation: "/locataires/candidats/inviter",
  etatsLieux: "/baux/etats-des-lieux",
  etatLieuxNew: "/baux/etats-des-lieux/nouveau",
  conges: "/baux/conges",
  assurances: "/conformite/assurances",
  paiementsEnLigne: "/finances/paiements-en-ligne",
  reservations: "/baux/reservations",
  reservationNew: "/baux/reservations/nouvelle",
  immeubles: "/biens/immeubles",
  immeubleNew: "/biens/immeubles/nouveau",
  equipements: "/biens/equipements",
  equipementNew: "/biens/equipements/nouveau",
  releves: "/biens/releves",
  inventaires: "/biens/inventaires",
  equipeInviter: "/equipe/inviter",
  loyers: "/finances/loyers",
  loyersPaiements: "/finances/loyers/paiements",
  loyerPaiementNew: "/finances/loyers/paiements/nouveau",
  loyersQuittances: "/finances/loyers/quittances",
  recouvrement: "/finances/recouvrement",
  factures: "/finances/factures",
  factureNew: "/finances/factures/nouvelle",
  agenda: "/agenda",
  agendaNew: "/agenda/nouveau",
  taches: "/taches",
  tacheNew: "/taches/nouvelle",
  contacts: "/contacts",
  contactNew: "/contacts/nouveau",
  journal: "/journal",
  reglagesFuseau: "/reglages/fuseau-horaire",
  fiscalite: "/finances/fiscalite",
  analytique: "/analytique",
  analytiqueRevenus: "/analytique/revenus-depenses",
  analytiqueOccupation: "/analytique/occupation",
  comptabilite: "/finances/comptabilite",
  comptabiliteEcritures: "/finances/comptabilite/ecritures",
  comptabiliteReleve: "/finances/comptabilite/releve",
  annonces: "/annonces",
  annonceNew: "/annonces/nouvelle",
  reglagesChamps: "/reglages/champs",
  reglagesRgpd: "/reglages/demandes-rgpd",
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

export function campagneHref(id: string): string {
  return `${agenceRoutes.campagnes}/${id}`;
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
