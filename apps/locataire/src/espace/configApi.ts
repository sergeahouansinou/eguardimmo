import {
  CircleHelp,
  CircleUser,
  ClipboardCheck,
  FolderOpen,
  KeyRound,
  Link2,
  LifeBuoy,
  Megaphone,
  MessageSquare,
  ReceiptText,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import type { AccountMenuConfig, BottomItem, PageResult, ShellNavigation } from "@eguardimmo/shell";
import { accountMenu } from "./config";

export const apiNavigation: ShellNavigation = {
  sections: [
    {
      id: "logement",
      label: "Mon logement",
      entries: [
        { id: "baux", label: "Mes baux", href: "/bail", icon: KeyRound },
        { id: "acces", label: "Mes accès", href: "/acces", icon: Link2 },
        {
          id: "loyers",
          label: "Loyers",
          href: "/loyers",
          icon: ReceiptText,
          children: [
            { id: "mes-loyers", label: "Mes loyers", href: "/loyers" },
            { id: "mes-quittances", label: "Mes quittances", href: "/loyers/quittances" },
            { id: "mes-paiements", label: "Mes paiements", href: "/loyers/paiements" },
            { id: "regularisation", label: "Régularisation des charges", href: "/loyers/regularisation" },
          ],
        },
        { id: "etats-des-lieux", label: "États des lieux", href: "/etats-des-lieux", icon: ClipboardCheck },
        { id: "documents", label: "Documents", href: "/documents", icon: FolderOpen },
      ],
    },
    {
      id: "echanges",
      label: "Échanges",
      entries: [
        { id: "messages", label: "Messages", href: "/messages", icon: MessageSquare },
        { id: "annonces", label: "Annonces", href: "/annonces", icon: Megaphone },
        { id: "interventions", label: "Interventions", href: "/interventions", icon: Wrench },
        { id: "assurance", label: "Assurance", href: "/assurance", icon: ShieldCheck },
        { id: "support", label: "Support", href: "/support", icon: LifeBuoy },
      ],
    },
  ],
  footer: [{ id: "aide", label: "Aide et support", href: "/aide", icon: CircleHelp }],
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
  { id: "baux", label: "Mes baux", icon: KeyRound, href: "/bail" },
  { id: "loyers", label: "Loyers", icon: ReceiptText, href: "/loyers" },
  { id: "acces", label: "Mes accès", icon: Link2, href: "/acces" },
  { id: "aide", label: "Aide", icon: CircleHelp, href: "/aide" },
];

export const apiAccountMenu: AccountMenuConfig = {
  roleLabels: accountMenu.roleLabels,
  switchSpace: accountMenu.switchSpace,
  signOut: accountMenu.signOut,
  groups: [
    {
      id: "compte",
      label: "Mon compte",
      items: [
        { id: "mes-informations", label: "Mes informations", href: "/compte", icon: CircleUser },
        { id: "securite", label: "Connexion et sécurité", href: "/compte/securite", icon: ShieldCheck },
        { id: "mes-acces", label: "Mes accès", href: "/acces", icon: Link2 },
      ],
    },
  ],
};

export const apiSearchPages: PageResult[] = [
  { href: "/bail", label: "Mes baux" },
  { href: "/loyers", label: "Mes loyers" },
  { href: "/loyers/quittances", label: "Mes quittances" },
  { href: "/loyers/paiements", label: "Mes paiements" },
  { href: "/loyers/regularisation", label: "Régularisation des charges" },
  { href: "/acces", label: "Mes accès" },
  { href: "/compte", label: "Mes informations" },
  { href: "/compte/modifier", label: "Modifier mes informations" },
  { href: "/documents", label: "Mes documents" },
  { href: "/assurance", label: "Assurance habitation" },
  { href: "/assurance/deposer", label: "Déposer une attestation d’assurance" },
  { href: "/etats-des-lieux", label: "Mes états des lieux" },
  { href: "/bail/conge", label: "Donner congé" },
  { href: "/loyers/payer", label: "Payer mon loyer" },
  { href: "/compte/securite", label: "Connexion et sécurité" },
  { href: "/annonces", label: "Annonces de mon agence" },
  { href: "/aide", label: "Aide et support" },
  { href: "/support", label: "Mes demandes au support" },
];
