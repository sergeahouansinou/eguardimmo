import { settle } from "@/features/equipe/settle";
import { parseInput } from "@/features/equipe/zodErrors";
import type { Store } from "@/features/shared/store";
import { notificationPrefsSchema } from "./notificationSchemas";
import type { NotificationPrefs, NotificationsView } from "./notificationSchemas";
import type { CompteSource } from "./source";

export const INITIAL_PREFS: NotificationPrefs = {
  events: {
    unpaidRent: true,
    paymentReceived: false,
    payoutDone: true,
    mandateExpiring: true,
    complianceRenewal: true,
    newMandant: true,
    newMessage: true,
    newIntervention: true,
    quoteReceived: true,
    ownerApproval: false,
  },
  channels: { email: true, app: true, mobile: false },
  digestFrequency: "monday",
  quietHours: true,
};

export function notificationsDemo(store: Store<NotificationPrefs>, email: () => string): Pick<CompteSource, "notifications" | "saveNotifications"> {
  return {
    notifications: (): Promise<NotificationsView> => settle(() => ({ prefs: store.get(), email: email(), quietHoursRange: "22:00 à 07:00" })),
    saveNotifications: (input) => settle(() => {
      const data = parseInput(notificationPrefsSchema, input);
      store.update(() => data);
      return data;
    }),
  };
}
