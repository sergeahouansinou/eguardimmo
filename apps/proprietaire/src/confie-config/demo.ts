import type { ShellData } from "@eguardimmo/shell";
import { createDemoData } from "@/features/confie/data/demo";
import { deriveCounts, deriveNotifications } from "@/features/confie/data/derive";
import type { NotificationItem } from "@/features/confie/data/derive";
import type { ConfieSource } from "@/features/confie/data/source";
import { createConfieStore } from "@/features/confie/data/store";
import type { ConfieData } from "@/features/confie/data/schemas";
import { confieRoutes } from "@/features/confie/routes";
import { toShellHref } from "./paths";

function notificationHref(target: NotificationItem["target"]): string {
  switch (target.kind) {
    case "intervention-devis":
      return confieRoutes.devis(target.id);
    case "compte-rendu":
      return confieRoutes.compteRendu(target.id);
    case "loyers":
      return confieRoutes.reversement(target.id);
    case "bien":
      return confieRoutes.bien(target.id);
  }
}

export function toShellData(data: ConfieData): ShellData {
  const { profile } = data;
  return {
    user: {
      firstName: profile.firstName,
      fullName: profile.representative,
      initials: profile.representative
        .split(" ")
        .map((part) => part.charAt(0))
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      email: profile.email,
    },
    workspace: { name: profile.denomination, ownerName: profile.representative, role: "mandant" },
    counts: deriveCounts(data),
    notifications: deriveNotifications(data).map((item) => ({
      id: item.id,
      tone: item.tone,
      title: item.title,
      detail: item.detail,
      unread: item.unread,
      href: toShellHref(notificationHref(item.target)),
    })),
  };
}

export function createConfieSource(initial: ConfieData = createDemoData()): ConfieSource {
  const store = createConfieStore(initial);
  const run = <T,>(action: () => T): Promise<T> => {
    try {
      return Promise.resolve(action());
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error("Opération impossible."));
    }
  };
  return {
    shell: () => run(() => toShellData(store.snapshot())),
    snapshot: () => run(() => store.snapshot()),
    markAllNotificationsRead: () => run(() => { store.markAllNotificationsRead(); }),
    decideQuote: (input) => run(() => { store.decideQuote(input); }),
    requestMandateEnd: (input) => run(() => { store.requestMandateEnd(input); }),
    cancelMandateEnd: () => run(() => { store.cancelMandateEnd(); }),
    updateProfile: (input) => run(() => { store.updateProfile(input); }),
    requestIbanChange: (input) => run(() => { store.requestIbanChange(input); }),
    addDocument: (input) => run(() => { store.addDocument(input); }),
    savePreferences: (input) => run(() => { store.savePreferences(input); }),
    markReportViewed: (reportId) => run(() => { store.markReportViewed(reportId); }),
  };
}
