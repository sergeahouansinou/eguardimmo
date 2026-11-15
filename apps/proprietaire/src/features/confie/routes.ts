export const CONFIE_BASE = "/confie";

export const confieRoutes = {
  home: CONFIE_BASE,
  biens: `${CONFIE_BASE}/biens`,
  bien: (id: string) => `${CONFIE_BASE}/biens/${id}`,
  loyers: `${CONFIE_BASE}/loyers`,
  reversement: (month: string) => `${CONFIE_BASE}/loyers/${month}`,
  comptesRendus: `${CONFIE_BASE}/comptes-rendus`,
  compteRendu: (id: string) => `${CONFIE_BASE}/comptes-rendus/${id}`,
  apercu: (id: string) => `${CONFIE_BASE}/comptes-rendus/${id}/apercu`,
  fiscalite: `${CONFIE_BASE}/fiscalite`,
  declaration: `${CONFIE_BASE}/fiscalite/declaration-2044`,
  documents: `${CONFIE_BASE}/documents`,
  interventions: `${CONFIE_BASE}/interventions`,
  intervention: (id: string) => `${CONFIE_BASE}/interventions/${id}`,
  devis: (id: string) => `${CONFIE_BASE}/interventions/${id}/devis`,
  agence: `${CONFIE_BASE}/agence`,
  mandat: `${CONFIE_BASE}/agence/mandat`,
  mandatFin: `${CONFIE_BASE}/agence/mandat/fin`,
  informations: `${CONFIE_BASE}/informations`,
  informationsModifier: `${CONFIE_BASE}/informations/modifier`,
  securite: `${CONFIE_BASE}/securite`,
  notifications: `${CONFIE_BASE}/notifications`,
  notificationsToutes: `${CONFIE_BASE}/notifications/toutes`,
  messages: `${CONFIE_BASE}/messages`,
  messageNouveau: `${CONFIE_BASE}/messages/nouveau`,
  aide: `${CONFIE_BASE}/aide`,
  gestionDirecte: "/",
  choixProfil: "/choix-du-profil",
  deconnexion: "/deconnexion",
} as const;

export const plannedConfieScreens: ReadonlyMap<string, string> = new Map([
  [confieRoutes.notificationsToutes, "Toutes les notifications"],
]);
