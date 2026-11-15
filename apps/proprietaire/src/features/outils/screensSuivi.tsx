"use client";

import {
  AgendaPage,
  ContactDetailPlanned,
  ContactFormPage,
  ContactsPage,
  DocumentImportPage,
  DocumentsPage,
  EvenementFormPage,
  InterventionDetailPlanned,
  InterventionFormPage,
  InterventionsPage,
  TacheFormPage,
  TachesPage,
} from "@eguardimmo/gestion";
import { bindScreen } from "./bindScreen";

export const AgendaScreen = bindScreen(AgendaPage);
export const EvenementFormScreen = bindScreen(EvenementFormPage);
export const TachesScreen = bindScreen(TachesPage);
export const TacheFormScreen = bindScreen(TacheFormPage);
export const ContactsScreen = bindScreen(ContactsPage);
export const ContactFormScreen = bindScreen(ContactFormPage);
export const ContactDetailScreen = bindScreen<{ id: string }>(ContactDetailPlanned);
export const DocumentsScreen = bindScreen(DocumentsPage);
export const DocumentImportScreen = bindScreen(DocumentImportPage);
export const InterventionsScreen = bindScreen(InterventionsPage);
export const InterventionFormScreen = bindScreen(InterventionFormPage);
export const InterventionDetailScreen = bindScreen<{ id: string }>(InterventionDetailPlanned);
