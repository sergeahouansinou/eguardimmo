import {
  Bell,
  CircleHelp,
  CircleUser,
  ClipboardCheck,
  FolderOpen,
  House,
  KeyRound,
  MessageSquare,
  ReceiptText,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import type { AccountMenuConfig, BottomItem, NotificationsConfig, PageResult, ShellCounts, ShellNavigation } from "@eguardimmo/shell";

export const SPACE_LABEL = "Espace locataire";
export const RAIL_STORAGE_KEY = "eg-nav-locataire";

export function buildNavigation(counts?: ShellCounts): ShellNavigation {
  return {
    sections: [
      {
        id: "principal",
        label: "Principal",
        entries: [
          { id: "accueil", label: "Accueil", href: "/", icon: House },
          { id: "loyers", label: "Loyers et quittances", href: "/loyers", icon: ReceiptText, count: counts?.loyers },
          { id: "interventions", label: "Interventions", href: "/interventions", icon: Wrench, count: counts?.interventions },
          { id: "messages", label: "Messages", href: "/messages", icon: MessageSquare, count: counts?.messages },
        ],
      },
      {
        id: "logement",
        label: "Mon logement",
        entries: [
          { id: "bail", label: "Mon bail", href: "/bail", icon: KeyRound },
          { id: "etats-des-lieux", label: "États des lieux", href: "/etats-des-lieux", icon: ClipboardCheck },
          { id: "documents", label: "Documents", href: "/documents", icon: FolderOpen },
          { id: "assurance", label: "Assurance habitation", href: "/assurance", icon: ShieldCheck },
        ],
      },
    ],
    footer: [{ id: "aide", label: "Aide", href: "/aide", icon: CircleHelp }],
  };
}

export const bottomItems: BottomItem[] = [
  { id: "accueil", label: "Accueil", icon: House, href: "/" },
  { id: "loyers", label: "Loyers", icon: ReceiptText, href: "/loyers" },
  { id: "interventions", label: "Interventions", icon: Wrench, href: "/interventions" },
  { id: "messages", label: "Messages", icon: MessageSquare, href: "/messages" },
];

export const accountMenu: AccountMenuConfig = {
  roleLabels: { locataire: "Locataire" },
  switchSpace: { href: "/choix-du-profil" },
  signOut: { href: "/deconnexion" },
  groups: [
    {
      id: "compte",
      label: "Mon compte",
      items: [
        { id: "mes-informations", label: "Mes informations", href: "/compte", icon: CircleUser },
        { id: "securite", label: "Sécurité", href: "/compte/securite", icon: ShieldCheck },
        { id: "notifications", label: "Notifications", href: "/notifications", icon: Bell },
      ],
    },
  ],
};

export const notifications: NotificationsConfig = { allHref: "/notifications", settingsHref: "/notifications" };

export const plannedScreens: ReadonlyMap<string, string> = new Map([
  ["/compte/gestion", "Gérer mon compte"],
  ["/choix-du-profil", "Choix du profil"],
  ["/deconnexion", "Déconnexion"],
]);

export const searchPages: PageResult[] = [
  { href: "/", label: "Accueil" },
  { href: "/loyers", label: "Loyers et quittances" },
  { href: "/loyers/payer", label: "Payer mon loyer" },
  { href: "/loyers/prelevement", label: "Prélèvement SEPA" },
  { href: "/loyers/regularisation", label: "Régularisation des charges" },
  { href: "/bail", label: "Mon bail" },
  { href: "/bail/conge", label: "Donner congé" },
  { href: "/etats-des-lieux", label: "États des lieux" },
  { href: "/documents", label: "Documents" },
  { href: "/interventions", label: "Interventions" },
  { href: "/interventions/nouvelle", label: "Signaler un problème" },
  { href: "/assurance", label: "Assurance habitation" },
  { href: "/assurance/deposer", label: "Déposer une attestation" },
  { href: "/compte", label: "Mes informations" },
  { href: "/compte/securite", label: "Sécurité" },
  { href: "/notifications", label: "Notifications" },
  { href: "/messages", label: "Messages" },
  { href: "/aide", label: "Aide" },
];
