import { totalUnread, useInboxStats, useOptionalStaffUnread } from "@eguardimmo/messagerie";
import { dataSource } from "@/lib/env";

function useApiMessagesCount(): number | undefined {
  const unread = useOptionalStaffUnread();
  return unread === undefined ? undefined : totalUnread(unread);
}

function useDemoMessagesCount(): number | undefined {
  return useInboxStats().data?.unread;
}

export const useMessagesCount: () => number | undefined = dataSource === "api" ? useApiMessagesCount : useDemoMessagesCount;
