'use client';

import { ShellSourceProvider } from '@eguardimmo/shell';
import type { ShellSource } from '@eguardimmo/shell';
import { createContext, use } from 'react';
import type { ReactNode } from 'react';
import type {
  AccessRequestInput,
  ActivityQuery,
  AccountFilters,
  AuditQuery,
  ChangePasswordInput,
  ChangeRoleInput,
  ClarificationInput,
  CreateOrganisationInput,
  ExportAuditResult,
  GeneralSettingsInput,
  IncidentNoteInput,
  IncidentUpdateInput,
  InviteInput,
  ListQuery,
  LoginInput,
  LoginResult,
  NotificationPrefs,
  OpenIncidentInput,
  OrganisationFilters,
  OrganisationType,
  PlanInput,
  ProfileInput,
  RestoreRequestInput,
  RgpdQuery,
  SecuritySettingsInput,
  SetFlagInput,
  SuspendInput,
  UpdateOrganisationInput,
} from './schemas';

export interface AuthApi {
  login: (input: LoginInput) => Promise<LoginResult>;
  signOut: () => Promise<void>;
}

export interface OrganisationsApi {
  list: (query: ListQuery & OrganisationFilters & { tab?: OrganisationType | '' }) => Promise<unknown>;
  get: (id: string) => Promise<unknown>;
  modules: (id: string) => Promise<unknown>;
  create: (input: CreateOrganisationInput) => Promise<{ id: string }>;
  update: (id: string, input: UpdateOrganisationInput) => Promise<void>;
  suspend: (id: string, input: SuspendInput) => Promise<void>;
  reactivate: (id: string) => Promise<void>;
  changePlan: (id: string, planId: string) => Promise<void>;
  setModules: (id: string, enabledIds: string[]) => Promise<void>;
  requestAccess: (id: string, input: AccessRequestInput) => Promise<void>;
}

export interface ComptesApi {
  list: (query: ListQuery & AccountFilters & { tab?: 'actif' | 'invite' | 'suspendu' | '' }) => Promise<unknown>;
  get: (id: string) => Promise<unknown>;
  suspend: (id: string, input: SuspendInput) => Promise<void>;
  reactivate: (id: string) => Promise<void>;
  resetTwoFactor: (id: string) => Promise<void>;
  revokeSessions: (id: string) => Promise<void>;
  requestAccess: (id: string, input: AccessRequestInput) => Promise<void>;
  export: (query: ListQuery & AccountFilters & { tab?: 'actif' | 'invite' | 'suspendu' | '' }) => Promise<ExportAuditResult>;
}

export interface ModulesApi {
  list: (query: { q?: string; tab?: '' | 'operational' | 'degraded'; group?: string }) => Promise<unknown>;
  get: (id: string) => Promise<unknown>;
  setFlag: (id: string, input: SetFlagInput) => Promise<void>;
  setPaused: (id: string, paused: boolean) => Promise<void>;
}

export interface AbonnementsApi {
  overview: () => Promise<unknown>;
  plan: (id: string) => Promise<unknown>;
  createPlan: (input: PlanInput) => Promise<{ id: string }>;
  updatePlan: (id: string, input: PlanInput) => Promise<void>;
}

export interface AuditApi {
  list: (query: AuditQuery) => Promise<unknown>;
  get: (id: string) => Promise<unknown>;
  export: (query: Omit<AuditQuery, 'page' | 'pageSize'>) => Promise<ExportAuditResult>;
}

export interface ActivityApi {
  list: (query: ActivityQuery) => Promise<unknown>;
  get: (id: string) => Promise<unknown>;
}

export interface RgpdApi {
  list: (query: RgpdQuery) => Promise<unknown>;
  get: (id: string) => Promise<unknown>;
  requestClarification: (id: string, input: ClarificationInput) => Promise<void>;
  advance: (id: string, stepKey: string) => Promise<void>;
}

export interface SanteApi {
  get: () => Promise<unknown>;
  incident: (id: string) => Promise<unknown>;
  openIncident: (input: OpenIncidentInput) => Promise<{ id: string }>;
  addNote: (id: string, input: IncidentNoteInput) => Promise<void>;
  publishUpdate: (id: string, input: IncidentUpdateInput) => Promise<void>;
  resolveIncident: (id: string) => Promise<void>;
}

export interface SauvegardesApi {
  get: () => Promise<unknown>;
  requestRestore: (input: RestoreRequestInput) => Promise<{ id: string }>;
}

export interface ParametresApi {
  general: () => Promise<unknown>;
  saveGeneral: (input: GeneralSettingsInput) => Promise<void>;
  security: () => Promise<unknown>;
  saveSecurity: (input: SecuritySettingsInput) => Promise<void>;
  notifications: () => Promise<unknown>;
  saveNotifications: (input: NotificationPrefs) => Promise<void>;
  profile: () => Promise<unknown>;
  saveProfile: (input: ProfileInput) => Promise<void>;
  changePassword: (input: ChangePasswordInput) => Promise<void>;
  regenerateBackupCodes: () => Promise<{ count: number }>;
}

export interface EquipeApi {
  list: () => Promise<unknown>;
  invite: (input: InviteInput) => Promise<{ id: string }>;
  changeRole: (id: string, input: ChangeRoleInput) => Promise<void>;
  setActive: (id: string, active: boolean) => Promise<void>;
}

export interface ConsoleSource extends ShellSource {
  markNotificationRead: (id: string) => Promise<void>;
  auth: AuthApi;
  overview: () => Promise<unknown>;
  organisations: OrganisationsApi;
  comptes: ComptesApi;
  modules: ModulesApi;
  abonnements: AbonnementsApi;
  audit: AuditApi;
  activity: ActivityApi;
  rgpd: RgpdApi;
  sante: SanteApi;
  sauvegardes: SauvegardesApi;
  parametres: ParametresApi;
  equipe: EquipeApi;
}

const SourceContext = createContext<ConsoleSource | null>(null);

export function ConsoleSourceProvider({ source, children }: { source: ConsoleSource; children: ReactNode }) {
  return (
    <SourceContext value={source}>
      <ShellSourceProvider source={source}>{children}</ShellSourceProvider>
    </SourceContext>
  );
}

export function useConsoleSource(): ConsoleSource {
  const source = use(SourceContext);
  if (!source) throw new Error('ConsoleSourceProvider manquant autour de la console.');
  return source;
}
