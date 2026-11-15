'use client';

import {
  accountDetailSchema,
  accountListSchema,
  auditDetailSchema,
  auditListSchema,
  equipeSchema,
  generalSettingsSchema,
  incidentDetailSchema,
  moduleDetailSchema,
  moduleListSchema,
  notificationPrefsSchema,
  organisationDetailSchema,
  organisationListSchema,
  organisationModulesSchema,
  overviewSchema,
  planDetailSchema,
  profileSchema,
  rgpdDetailSchema,
  rgpdListSchema,
  santeSchema,
  sauvegardesSchema,
  securitySettingsSchema,
  subscriptionsOverviewSchema,
} from '../schemas';
import type {
  AccountDetail,
  AccountFilters,
  AccountList,
  AuditDetail,
  AuditList,
  AuditQuery,
  Equipe,
  GeneralSettings,
  IncidentDetail,
  ListQuery,
  ModuleDetail,
  ModuleList,
  NotificationPrefs,
  OrganisationDetail,
  OrganisationFilters,
  OrganisationList,
  OrganisationModules,
  Overview,
  PlanDetail,
  Profile,
  RgpdDetail,
  RgpdList,
  RgpdQuery,
  Sante,
  Sauvegardes,
  SecuritySettings,
  SubscriptionsOverview,
} from '../schemas';
import { useConsoleQuery } from './core';
import type { ConsoleQuery } from './core';

export const useOverview = (): ConsoleQuery<Overview> => useConsoleQuery(['overview'], (source) => source.overview(), overviewSchema);

export const useOrganisations = (query: ListQuery & OrganisationFilters): ConsoleQuery<OrganisationList> =>
  useConsoleQuery(['organisations', 'list', query], (source) => source.organisations.list(query), organisationListSchema, { keepPrevious: true });

export const useOrganisation = (id: string): ConsoleQuery<OrganisationDetail> =>
  useConsoleQuery(['organisations', 'detail', id], (source) => source.organisations.get(id), organisationDetailSchema);

export const useOrganisationModules = (id: string): ConsoleQuery<OrganisationModules> =>
  useConsoleQuery(['organisations', 'modules', id], (source) => source.organisations.modules(id), organisationModulesSchema);

export const useAccounts = (query: ListQuery & AccountFilters & { tab?: 'actif' | 'invite' | 'suspendu' | '' }): ConsoleQuery<AccountList> =>
  useConsoleQuery(['comptes', 'list', query], (source) => source.comptes.list(query), accountListSchema, { keepPrevious: true });

export const useAccount = (id: string): ConsoleQuery<AccountDetail> =>
  useConsoleQuery(['comptes', 'detail', id], (source) => source.comptes.get(id), accountDetailSchema);

export const useModules = (query: { q?: string; tab?: '' | 'operational' | 'degraded'; group?: string }): ConsoleQuery<ModuleList> =>
  useConsoleQuery(['modules', 'list', query], (source) => source.modules.list(query), moduleListSchema, { keepPrevious: true });

export const useModule = (id: string): ConsoleQuery<ModuleDetail> =>
  useConsoleQuery(['modules', 'detail', id], (source) => source.modules.get(id), moduleDetailSchema);

export const useSubscriptions = (): ConsoleQuery<SubscriptionsOverview> =>
  useConsoleQuery(['abonnements', 'overview'], (source) => source.abonnements.overview(), subscriptionsOverviewSchema);

export const usePlan = (id: string): ConsoleQuery<PlanDetail> =>
  useConsoleQuery(['abonnements', 'plan', id], (source) => source.abonnements.plan(id), planDetailSchema);

export const useAuditList = (query: AuditQuery): ConsoleQuery<AuditList> =>
  useConsoleQuery(['audit', 'list', query], (source) => source.audit.list(query), auditListSchema, { keepPrevious: true });

export const useAuditEvent = (id: string): ConsoleQuery<AuditDetail> =>
  useConsoleQuery(['audit', 'detail', id], (source) => source.audit.get(id), auditDetailSchema);

export const useRgpdList = (query: RgpdQuery): ConsoleQuery<RgpdList> =>
  useConsoleQuery(['rgpd', 'list', query], (source) => source.rgpd.list(query), rgpdListSchema, { keepPrevious: true });

export const useRgpdRequest = (id: string): ConsoleQuery<RgpdDetail> =>
  useConsoleQuery(['rgpd', 'detail', id], (source) => source.rgpd.get(id), rgpdDetailSchema);

export const useSante = (): ConsoleQuery<Sante> => useConsoleQuery(['sante'], (source) => source.sante.get(), santeSchema);

export const useIncident = (id: string): ConsoleQuery<IncidentDetail> =>
  useConsoleQuery(['sante', 'incident', id], (source) => source.sante.incident(id), incidentDetailSchema);

export const useSauvegardes = (): ConsoleQuery<Sauvegardes> =>
  useConsoleQuery(['sauvegardes'], (source) => source.sauvegardes.get(), sauvegardesSchema);

export const useGeneralSettings = (): ConsoleQuery<GeneralSettings> =>
  useConsoleQuery(['parametres', 'general'], (source) => source.parametres.general(), generalSettingsSchema);

export const useSecuritySettings = (): ConsoleQuery<SecuritySettings> =>
  useConsoleQuery(['parametres', 'securite'], (source) => source.parametres.security(), securitySettingsSchema);

export const useNotificationPrefs = (): ConsoleQuery<NotificationPrefs> =>
  useConsoleQuery(['parametres', 'notifications'], (source) => source.parametres.notifications(), notificationPrefsSchema);

export const useProfile = (): ConsoleQuery<Profile> =>
  useConsoleQuery(['parametres', 'profil'], (source) => source.parametres.profile(), profileSchema);

export const useEquipe = (): ConsoleQuery<Equipe> => useConsoleQuery(['equipe'], (source) => source.equipe.list(), equipeSchema);
