import type { z } from "zod";
import { agenceKey, useAgenceMutation, useAgenceQuery } from "@/features/query";
import { notificationsViewSchema } from "./notificationSchemas";
import type { NotificationPrefs } from "./notificationSchemas";
import { exportRowsSchema, profileSchema } from "./profileSchemas";
import type { ProfileInput } from "./profileSchemas";
import { securitySchema } from "./securitySchemas";
import type { PasswordChangeInput, SecurityRulesInput } from "./securitySchemas";
import { subscriptionSchema } from "./subscriptionSchemas";
import type { AddPaymentMethodInput, BillingInput, ChangePlanInput } from "./subscriptionSchemas";

export function useProfile() {
  return useAgenceQuery(agenceKey("compte", "profile"), profileSchema, (source) => source.compte.profile());
}

export function useSaveProfile() {
  return useAgenceMutation((source, input: ProfileInput) => source.compte.saveProfile(input));
}

export function useExportData() {
  return useAgenceMutation<undefined, z.output<typeof exportRowsSchema>>(async (source) => exportRowsSchema.parse(await source.compte.exportData()));
}

export function useSecurity() {
  return useAgenceQuery(agenceKey("compte", "security"), securitySchema, (source) => source.compte.security());
}

export function useSaveSecurityRules() {
  return useAgenceMutation((source, input: SecurityRulesInput) => source.compte.saveSecurityRules(input));
}

export function useChangePassword() {
  return useAgenceMutation((source, input: PasswordChangeInput) => source.compte.changePassword(input));
}

export function useSignOutDevice() {
  return useAgenceMutation((source, deviceId: string) => source.compte.signOutDevice(deviceId));
}

export function useNotifications() {
  return useAgenceQuery(agenceKey("compte", "notifications"), notificationsViewSchema, (source) => source.compte.notifications());
}

export function useSaveNotifications() {
  return useAgenceMutation((source, input: NotificationPrefs) => source.compte.saveNotifications(input));
}

export function useSubscription() {
  return useAgenceQuery(agenceKey("compte", "subscription"), subscriptionSchema, (source) => source.compte.subscription());
}

export function useChangePlan() {
  return useAgenceMutation((source, input: ChangePlanInput) => source.compte.changePlan(input));
}

export function useAddPaymentMethod() {
  return useAgenceMutation((source, input: AddPaymentMethodInput) => source.compte.addPaymentMethod(input));
}

export function useRemovePaymentMethod() {
  return useAgenceMutation((source, methodId: string) => source.compte.removePaymentMethod(methodId));
}

export function useSaveBilling() {
  return useAgenceMutation((source, input: BillingInput) => source.compte.saveBilling(input));
}
