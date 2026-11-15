'use client';

import { createSourceContext, useScreenQuery, useSourceMutation } from '../../outils/kit';
import { demoDocuments, demoGeneral, demoMenu, demoNotifications } from './demo';
import { documentsSchema, generalSchema, menuSchema, notificationsSchema } from './schemas';
import type { DocumentsSettings, GeneralSettings, MenuSettings, NotificationsSettings } from './schemas';

export interface ReglagesSource {
  getGeneral: () => Promise<GeneralSettings>;
  saveGeneral: (value: GeneralSettings) => Promise<GeneralSettings>;
  getDocuments: () => Promise<DocumentsSettings>;
  saveDocuments: (value: DocumentsSettings) => Promise<DocumentsSettings>;
  getMenu: () => Promise<MenuSettings>;
  saveMenu: (value: MenuSettings) => Promise<MenuSettings>;
  getNotifications: () => Promise<NotificationsSettings>;
  saveNotifications: (value: NotificationsSettings) => Promise<NotificationsSettings>;
}

function store<T>(initial: T, parse: (value: unknown) => T) {
  let current = structuredClone(initial);
  return {
    get: () => Promise.resolve(structuredClone(current)),
    save: (value: T) => {
      try {
        current = parse(structuredClone(value));
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error('Réglages invalides'));
      }
      return Promise.resolve(structuredClone(current));
    },
  };
}

export function createDemoReglagesSource(): ReglagesSource {
  const general = store(demoGeneral, (value) => generalSchema.parse(value));
  const documents = store(demoDocuments, (value) => documentsSchema.parse(value));
  const menu = store(demoMenu, (value) => menuSchema.parse(value));
  const notifications = store(demoNotifications, (value) => notificationsSchema.parse(value));
  return {
    getGeneral: general.get,
    saveGeneral: general.save,
    getDocuments: documents.get,
    saveDocuments: documents.save,
    getMenu: menu.get,
    saveMenu: menu.save,
    getNotifications: notifications.get,
    saveNotifications: notifications.save,
  };
}

const context = createSourceContext<ReglagesSource>(createDemoReglagesSource);

export const ReglagesSourceProvider = context.Provider;
export const useReglagesSource = context.useSource;
export const resetReglagesDemo = context.resetDefault;

export const reglagesKeys = {
  general: ['compte', 'reglages', 'general'] as const,
  documents: ['compte', 'reglages', 'documents'] as const,
  menu: ['compte', 'reglages', 'menu'] as const,
  notifications: ['compte', 'reglages', 'notifications'] as const,
};

export function useGeneralSettings() {
  const source = useReglagesSource();
  return useScreenQuery(reglagesKeys.general, () => source.getGeneral(), generalSchema);
}
export function useSaveGeneral() {
  const source = useReglagesSource();
  return useSourceMutation((value: GeneralSettings) => source.saveGeneral(value), [reglagesKeys.general]);
}

export function useDocumentsSettings() {
  const source = useReglagesSource();
  return useScreenQuery(reglagesKeys.documents, () => source.getDocuments(), documentsSchema);
}
export function useSaveDocuments() {
  const source = useReglagesSource();
  return useSourceMutation((value: DocumentsSettings) => source.saveDocuments(value), [reglagesKeys.documents]);
}

export function useMenuSettings() {
  const source = useReglagesSource();
  return useScreenQuery(reglagesKeys.menu, () => source.getMenu(), menuSchema);
}
export function useSaveMenu() {
  const source = useReglagesSource();
  return useSourceMutation((value: MenuSettings) => source.saveMenu(value), [reglagesKeys.menu]);
}

export function useNotificationsSettings() {
  const source = useReglagesSource();
  return useScreenQuery(reglagesKeys.notifications, () => source.getNotifications(), notificationsSchema);
}
export function useSaveNotifications() {
  const source = useReglagesSource();
  return useSourceMutation((value: NotificationsSettings) => source.saveNotifications(value), [reglagesKeys.notifications]);
}
