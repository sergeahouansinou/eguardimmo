import type { ApiClient } from '@eguardimmo/api';
import type { ConsoleSource } from '../source';
import { unavailable } from '../unavailable';
import { activityApi } from './activity';
import { NOTIFICATIONS_UNAVAILABLE_MESSAGE, fetchMe, toShellData } from './me';
import type { AuthApi } from '../source';

export interface ApiConsole {
  source: ConsoleSource;
  operatorId: () => Promise<string>;
}

export function createApiConsoleSource(client: ApiClient, auth: AuthApi): ApiConsole {
  const operatorId = async () => (await fetchMe(client)).id;
  const source: ConsoleSource = {
    shell: async () => toShellData(await fetchMe(client)),
    markAllNotificationsRead: () => Promise.reject(new Error(NOTIFICATIONS_UNAVAILABLE_MESSAGE)),
    markNotificationRead: () => Promise.reject(new Error(NOTIFICATIONS_UNAVAILABLE_MESSAGE)),
    auth,
    overview: unavailable,
    organisations: {
      list: unavailable,
      get: unavailable,
      modules: unavailable,
      create: unavailable,
      update: unavailable,
      suspend: unavailable,
      reactivate: unavailable,
      changePlan: unavailable,
      setModules: unavailable,
      requestAccess: unavailable,
    },
    comptes: {
      list: unavailable,
      get: unavailable,
      suspend: unavailable,
      reactivate: unavailable,
      resetTwoFactor: unavailable,
      revokeSessions: unavailable,
      requestAccess: unavailable,
      export: unavailable,
    },
    modules: { list: unavailable, get: unavailable, setFlag: unavailable, setPaused: unavailable },
    abonnements: { overview: unavailable, plan: unavailable, createPlan: unavailable, updatePlan: unavailable },
    audit: { list: unavailable, get: unavailable, export: unavailable },
    activity: activityApi(client),
    rgpd: { list: unavailable, get: unavailable, requestClarification: unavailable, advance: unavailable },
    sante: { get: unavailable, incident: unavailable, openIncident: unavailable, addNote: unavailable, publishUpdate: unavailable, resolveIncident: unavailable },
    sauvegardes: { get: unavailable, requestRestore: unavailable },
    parametres: {
      general: unavailable,
      saveGeneral: unavailable,
      security: unavailable,
      saveSecurity: unavailable,
      notifications: unavailable,
      saveNotifications: unavailable,
      profile: unavailable,
      saveProfile: unavailable,
      changePassword: unavailable,
      regenerateBackupCodes: unavailable,
    },
    equipe: { list: unavailable, invite: unavailable, changeRole: unavailable, setActive: unavailable },
  };
  return { source, operatorId };
}
