import { ArrowLeftRight, Bell, Building, Calculator, CircleUser, FileChartColumn, FileText, Folder, House, Landmark, LifeBuoy, Link2, Megaphone, MessageSquare, Receipt, ScrollText, ShieldCheck, Wallet, Wrench } from "lucide-react";
import { authUrl } from "@eguardimmo/shell";
import type { AccountMenuConfig, BottomItem, NotificationsConfig, PageResult, ShellNavigation } from "@eguardimmo/shell";
import { toShellHref } from "@/confie-config/paths";
import { confieRoutes } from "@/features/confie/routes";

const href = toShellHref;

export const apiNavigation: ShellNavigation = {
  sections: [
    {
      id: "patrimoine",
      label: "Mon patrimoine",
      entries: [
        { id: "accueil", label: "Accueil", href: href(confieRoutes.home), icon: House },
        { id: "acces", label: "Mes accès", href: href(confieRoutes.agence), icon: Link2 },
        { id: "mandat", label: "Mon mandat", href: href(confieRoutes.mandat), icon: FileText },
        { id: "biens", label: "Mes biens", href: href(confieRoutes.biens), icon: Building },
        { id: "baux", label: "Baux", href: href(confieRoutes.baux), icon: FileText },
        { id: "loyers", label: "Loyers et reversements", href: href(confieRoutes.loyers), icon: Wallet },
        { id: "releve", label: "Relevé de compte", href: href(confieRoutes.releve), icon: ScrollText },
        { id: "charges", label: "Décomptes de charges", href: href(confieRoutes.charges), icon: Calculator },
        { id: "compte-de-paiement", label: "Compte de paiement", href: href(confieRoutes.compteDePaiement), icon: Landmark },
        { id: "comptes-rendus", label: "Comptes rendus", href: href(confieRoutes.comptesRendus), icon: FileChartColumn },
        { id: "documents", label: "Documents", href: href(confieRoutes.documents), icon: Folder },
        { id: "factures", label: "Factures d’honoraires", href: href(confieRoutes.factures), icon: Receipt },
      ],
    },
    {
      id: "echanges",
      label: "Échanges",
      entries: [
        { id: "messages", label: "Messages", href: href(confieRoutes.messages), icon: MessageSquare },
        { id: "annonces", label: "Annonces", href: href(confieRoutes.annonces), icon: Megaphone },
        { id: "interventions", label: "Interventions", href: href(confieRoutes.interventions), icon: Wrench },
        { id: "support", label: "Support", href: href(confieRoutes.support), icon: LifeBuoy },
      ],
    },
  ],
  footer: [{ id: "gestion-directe", label: "Mes biens en gestion directe", href: href(confieRoutes.gestionDirecte), icon: ArrowLeftRight }],
};

export function withMessageCount(navigation: ShellNavigation, unread: number | undefined): ShellNavigation {
  if (unread === undefined) return navigation;
  return {
    ...navigation,
    sections: navigation.sections.map((section) => ({
      ...section,
      entries: section.entries.map((entry) => (entry.id === "messages" ? { ...entry, count: unread } : entry)),
    })),
  };
}

export function withAnnouncementCount(navigation: ShellNavigation, unread: number | undefined): ShellNavigation {
  if (unread === undefined) return navigation;
  return {
    ...navigation,
    sections: navigation.sections.map((section) => ({
      ...section,
      entries: section.entries.map((entry) => (entry.id === "annonces" ? { ...entry, count: unread } : entry)),
    })),
  };
}

export function withSupportCount(navigation: ShellNavigation, unread: number | undefined): ShellNavigation {
  if (unread === undefined) return navigation;
  return {
    ...navigation,
    sections: navigation.sections.map((section) => ({
      ...section,
      entries: section.entries.map((entry) => (entry.id === "support" ? { ...entry, count: unread } : entry)),
    })),
  };
}

export const apiBottomItems: BottomItem[] = [
  { id: "accueil", label: "Accueil", icon: House, href: href(confieRoutes.home) },
  { id: "acces", label: "Mes accès", icon: Link2, href: href(confieRoutes.agence) },
  { id: "biens", label: "Biens", icon: Building, href: href(confieRoutes.biens) },
  { id: "loyers", label: "Loyers", icon: Wallet, href: href(confieRoutes.loyers) },
];

export const apiAccountMenu: AccountMenuConfig = {
  roleLabels: { mandant: "Propriétaire mandant" },
  switchSpace: { href: authUrl("/profils") },
  signOut: { href: authUrl("/deconnecte") },
  groups: [
    {
      id: "compte",
      label: "Mon compte",
      items: [
        { id: "acces", label: "Mes accès", href: href(confieRoutes.agence), icon: Link2 },
        { id: "notifications", label: "Préférences de notification", href: href(confieRoutes.notifications), icon: Bell },
        { id: "securite", label: "Connexion et sécurité", href: authUrl("/compte/securite"), icon: ShieldCheck },
      ],
    },
    {
      id: "espaces",
      label: "Autre espace",
      items: [{ id: "gestion-directe", label: "Mes biens en gestion directe", href: href(confieRoutes.gestionDirecte), icon: CircleUser }],
    },
  ],
  footerItems: [],
};

export const apiNotifications: NotificationsConfig = {
  allHref: href(confieRoutes.notificationsToutes),
  settingsHref: href(confieRoutes.notifications),
};

export const apiSearchPages: PageResult[] = [
  { href: href(confieRoutes.home), label: "Accueil" },
  { href: href(confieRoutes.agence), label: "Mes accès, me détacher d’un mandat" },
  { href: href(confieRoutes.biens), label: "Mes biens" },
  { href: href(confieRoutes.mandat), label: "Mon mandat, demander la fin du mandat" },
  { href: href(confieRoutes.baux), label: "Baux" },
  { href: href(confieRoutes.loyers), label: "Loyers et reversements" },
  { href: href(confieRoutes.releve), label: "Relevé de compte, solde du compte mandant, export CSV" },
  { href: href(confieRoutes.charges), label: "Décomptes de charges, régularisation des charges" },
  { href: href(confieRoutes.compteDePaiement), label: "Compte de paiement, changer d’IBAN" },
  { href: href(confieRoutes.comptesRendus), label: "Comptes rendus" },
  { href: href(confieRoutes.documents), label: "Documents" },
  { href: href(confieRoutes.factures), label: "Factures d’honoraires" },
  { href: href(confieRoutes.interventions), label: "Interventions" },
  { href: href(confieRoutes.annonces), label: "Annonces de mon agence" },
  { href: href(confieRoutes.support), label: "Support, mes demandes" },
  { href: href(confieRoutes.gestionDirecte), label: "Mes biens en gestion directe" },
];
