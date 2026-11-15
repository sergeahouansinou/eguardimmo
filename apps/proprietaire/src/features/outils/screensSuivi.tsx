"use client";

import {
  AgendaPage,
  ContactDetailPage,
  ContactFormPage,
  ContactsPage,
  DocumentImportPage,
  DocumentsPage,
  EvenementFormPage,
  InterventionDetailPage,
  InterventionFormPage,
  InterventionsPage,
  TacheFormPage,
  TachesPage,
} from "@eguardimmo/gestion";
import { bindScreen } from "./bindScreen";

export const AgendaScreen = bindScreen(AgendaPage);
export const EvenementFormScreen = bindScreen(EvenementFormPage);
export const TachesScreen = bindScreen(TachesPage);
export const TacheFormScreen = bindScreen<{ id?: string }>(TacheFormPage);
export const ContactsScreen = bindScreen(ContactsPage);
export const ContactFormScreen = bindScreen<{ id?: string }>(ContactFormPage);
export const ContactDetailScreen = bindScreen<{ id: string }>(ContactDetailPage);
export const DocumentsScreen = bindScreen(DocumentsPage);
export const DocumentImportScreen = bindScreen(DocumentImportPage);
export const InterventionsScreen = bindScreen(InterventionsPage);
export const InterventionFormScreen = bindScreen<{ id?: string }>(InterventionFormPage);
export const InterventionDetailScreen = bindScreen<{ id: string }>(InterventionDetailPage);
