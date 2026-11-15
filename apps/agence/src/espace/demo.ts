import type { ShellData, ShellSource } from "@eguardimmo/shell";

export const demoShell: ShellData = {
  user: { firstName: "Sophie", fullName: "Sophie Delmas", initials: "SD", email: "sophie.delmas@example.com" },
  workspace: { name: "Cabinet Delmas Immobilier", ownerName: "Sophie Delmas", role: "admin", plan: "Pro", members: 3 },
  counts: { mandats: 6, biens: 14, impayes: 3, reversements: 6, comptesRendus: 6, messages: 4, interventions: 3 },
  notifications: [
    { id: "n1", tone: "danger", title: "Impayé : Anaïs Roux, Studio 4", detail: "450 € dus depuis 12 jours", unread: true, href: "/finances/impayes" },
    { id: "n2", tone: "warning", title: "Assurance RCP à renouveler", detail: "Échéance le 31/12/2026", unread: true, href: "/conformite" },
    { id: "n3", tone: "info", title: "Message d'Anaïs Roux", detail: "« Je règle le 15/11 »", unread: false, href: "/messages" },
  ],
};

export function createDemoSource(): ShellSource {
  let shell = structuredClone(demoShell);
  return {
    shell: () => Promise.resolve(structuredClone(shell)),
    markAllNotificationsRead: () => {
      shell = { ...shell, notifications: shell.notifications.map((item) => ({ ...item, unread: false })) };
      return Promise.resolve();
    },
  };
}
