"use client";

import {
  AbonnementPage,
  ComptePage,
  EquipeInvitePage,
  EquipePage,
  ExportPage,
  JournalPage,
  ReglagesDocumentsPage,
  ReglagesMenuPage,
  ReglagesNotificationsPage,
  ReglagesPage,
} from "@eguardimmo/gestion";
import { bindScreen } from "./bindScreen";

export const JournalScreen = bindScreen(JournalPage);
export const ReglagesScreen = bindScreen(ReglagesPage);
export const ReglagesDocumentsScreen = bindScreen(ReglagesDocumentsPage);
export const ReglagesMenuScreen = bindScreen(ReglagesMenuPage);
export const ReglagesNotificationsScreen = bindScreen(ReglagesNotificationsPage);
export const EquipeScreen = bindScreen(EquipePage);
export const EquipeInviteScreen = bindScreen(EquipeInvitePage);
export const CompteScreen = bindScreen(ComptePage);
export const AbonnementScreen = bindScreen(AbonnementPage);
export const ExportScreen = bindScreen(ExportPage);
