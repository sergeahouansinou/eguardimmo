"use client";

import {
  ActivityJournalPage,
  AnalyticsHubPage,
  ForecastScreen,
  OccupancyPage,
  ProfitabilityScreen,
  RevenueExpensesPage,
  DirectoryContactDetailPage,
  DirectoryContactFormPage,
  DirectoryContactsPage,
  PlanningAgendaPage,
  PlanningEventDetailPage,
  PlanningEventFormPage,
  PlanningTaskDetailPage,
  PlanningTaskFormPage,
  PlanningTasksPage,
  TimezoneSettingsPage,
} from "@eguardimmo/gestion";
import { bindLot } from "@/features/locataires/LotBridge";

export const AgendaApiScreen = bindLot(PlanningAgendaPage);
export const EvenementFormApiScreen = bindLot(PlanningEventFormPage);
export const EvenementDetailApiScreen = bindLot(PlanningEventDetailPage);
export const TachesApiScreen = bindLot(PlanningTasksPage);
export const TacheFormApiScreen = bindLot(PlanningTaskFormPage);
export const TacheDetailApiScreen = bindLot(PlanningTaskDetailPage);
export const ContactsApiScreen = bindLot(DirectoryContactsPage);
export const ContactFormApiScreen = bindLot(DirectoryContactFormPage);
export const ContactDetailApiScreen = bindLot(DirectoryContactDetailPage);
export const JournalApiScreen = bindLot(ActivityJournalPage);
export const FuseauHoraireApiScreen = bindLot(TimezoneSettingsPage);

export const AnalytiqueVueApiScreen = bindLot(AnalyticsHubPage);
export const AnalytiqueRevDepApiScreen = bindLot(RevenueExpensesPage);
export const AnalytiqueOccApiScreen = bindLot(OccupancyPage);
export const AnalytiqueRentaApiScreen = bindLot(ProfitabilityScreen);
export const AnalytiquePrevApiScreen = bindLot(ForecastScreen);
