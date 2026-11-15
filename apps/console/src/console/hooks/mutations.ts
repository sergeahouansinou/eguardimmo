'use client';

import type {
  AccessRequestInput,
  ChangePasswordInput,
  ChangeRoleInput,
  ClarificationInput,
  CreateOrganisationInput,
  GeneralSettingsInput,
  IncidentNoteInput,
  IncidentUpdateInput,
  InviteInput,
  NotificationPrefs,
  OpenIncidentInput,
  PlanInput,
  ProfileInput,
  RestoreRequestInput,
  SecuritySettingsInput,
  SetFlagInput,
  SuspendInput,
  UpdateOrganisationInput,
} from '../schemas';
import { useConsoleMutation } from './core';

export const useCreateOrganisation = () =>
  useConsoleMutation((source, input: CreateOrganisationInput) => source.organisations.create(input));
export const useUpdateOrganisation = (id: string) =>
  useConsoleMutation((source, input: UpdateOrganisationInput) => source.organisations.update(id, input));
export const useSuspendOrganisation = (id: string) =>
  useConsoleMutation((source, input: SuspendInput) => source.organisations.suspend(id, input));
export const useReactivateOrganisation = (id: string) => useConsoleMutation((source) => source.organisations.reactivate(id));
export const useChangePlan = (id: string) => useConsoleMutation((source, planId: string) => source.organisations.changePlan(id, planId));
export const useSetOrganisationModules = (id: string) =>
  useConsoleMutation((source, enabledIds: string[]) => source.organisations.setModules(id, enabledIds));
export const useRequestOrganisationAccess = (id: string) =>
  useConsoleMutation((source, input: AccessRequestInput) => source.organisations.requestAccess(id, input));

export const useSuspendAccount = (id: string) => useConsoleMutation((source, input: SuspendInput) => source.comptes.suspend(id, input));
export const useReactivateAccount = (id: string) => useConsoleMutation((source) => source.comptes.reactivate(id));
export const useResetTwoFactor = (id: string) => useConsoleMutation((source) => source.comptes.resetTwoFactor(id));
export const useRevokeSessions = (id: string) => useConsoleMutation((source) => source.comptes.revokeSessions(id));
export const useRequestAccountAccess = (id: string) =>
  useConsoleMutation((source, input: AccessRequestInput) => source.comptes.requestAccess(id, input));

export const useExportAccounts = () =>
  useConsoleMutation((source, query: Parameters<typeof source.comptes.export>[0]) => source.comptes.export(query));

export const useSetFlag = (id: string) => useConsoleMutation((source, input: SetFlagInput) => source.modules.setFlag(id, input));
export const useSetPaused = (id: string) => useConsoleMutation((source, paused: boolean) => source.modules.setPaused(id, paused));

export const useCreatePlan = () => useConsoleMutation((source, input: PlanInput) => source.abonnements.createPlan(input));
export const useUpdatePlan = (id: string) => useConsoleMutation((source, input: PlanInput) => source.abonnements.updatePlan(id, input));

export const useExportAudit = () =>
  useConsoleMutation((source, query: Parameters<typeof source.audit.export>[0]) => source.audit.export(query));

export const useRequestClarification = (id: string) =>
  useConsoleMutation((source, input: ClarificationInput) => source.rgpd.requestClarification(id, input));
export const useAdvanceRgpd = (id: string) => useConsoleMutation((source, stepKey: string) => source.rgpd.advance(id, stepKey));

export const useOpenIncident = () => useConsoleMutation((source, input: OpenIncidentInput) => source.sante.openIncident(input));
export const useAddIncidentNote = (id: string) => useConsoleMutation((source, input: IncidentNoteInput) => source.sante.addNote(id, input));
export const usePublishIncidentUpdate = (id: string) =>
  useConsoleMutation((source, input: IncidentUpdateInput) => source.sante.publishUpdate(id, input));
export const useResolveIncident = (id: string) => useConsoleMutation((source) => source.sante.resolveIncident(id));

export const useRequestRestore = () => useConsoleMutation((source, input: RestoreRequestInput) => source.sauvegardes.requestRestore(input));

export const useSaveGeneralSettings = () => useConsoleMutation((source, input: GeneralSettingsInput) => source.parametres.saveGeneral(input));
export const useSaveSecuritySettings = () =>
  useConsoleMutation((source, input: SecuritySettingsInput) => source.parametres.saveSecurity(input));
export const useSaveNotificationPrefs = () => useConsoleMutation((source, input: NotificationPrefs) => source.parametres.saveNotifications(input));
export const useSaveProfile = () => useConsoleMutation((source, input: ProfileInput) => source.parametres.saveProfile(input));
export const useChangePassword = () => useConsoleMutation((source, input: ChangePasswordInput) => source.parametres.changePassword(input));
export const useRegenerateBackupCodes = () => useConsoleMutation((source) => source.parametres.regenerateBackupCodes());

export const useInviteOperator = () => useConsoleMutation((source, input: InviteInput) => source.equipe.invite(input));
export const useChangeOperatorRole = (id: string) => useConsoleMutation((source, input: ChangeRoleInput) => source.equipe.changeRole(id, input));
export const useSetOperatorActive = (id: string) => useConsoleMutation((source, active: boolean) => source.equipe.setActive(id, active));
