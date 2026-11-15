import { z } from "zod";

export const EVENT_KEYS = [
  "unpaidRent",
  "paymentReceived",
  "payoutDone",
  "mandateExpiring",
  "complianceRenewal",
  "newMandant",
  "newMessage",
  "newIntervention",
  "quoteReceived",
  "ownerApproval",
] as const;
export type EventKey = (typeof EVENT_KEYS)[number];

export const CHANNEL_KEYS = ["email", "app", "mobile"] as const;
export type ChannelKey = (typeof CHANNEL_KEYS)[number];

export const DIGEST_OPTIONS = [
  { value: "monday", label: "Chaque lundi" },
  { value: "daily", label: "Chaque jour" },
  { value: "never", label: "Jamais" },
] as const;

export const notificationPrefsSchema = z.object({
  events: z.record(z.enum(EVENT_KEYS), z.boolean()),
  channels: z.record(z.enum(CHANNEL_KEYS), z.boolean()),
  digestFrequency: z.enum(["monday", "daily", "never"]),
  quietHours: z.boolean(),
});
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;

export const notificationsViewSchema = z.object({
  prefs: notificationPrefsSchema,
  email: z.string(),
  quietHoursRange: z.string(),
});
export type NotificationsView = z.infer<typeof notificationsViewSchema>;
