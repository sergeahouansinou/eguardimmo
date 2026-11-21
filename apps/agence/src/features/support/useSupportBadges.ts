import { useAccessSummary, useSupportUnread } from "@eguardimmo/messagerie";

export interface SupportBadges {
  requests: number | undefined;
  access: number | undefined;
}

export function useSupportBadges(): SupportBadges {
  const requests = useSupportUnread();
  const summary = useAccessSummary();
  return { requests, access: summary === undefined ? undefined : summary.pending + summary.emergencies.length };
}
