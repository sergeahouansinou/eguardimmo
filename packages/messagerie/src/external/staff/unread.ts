'use client';

import { useQuery } from '@tanstack/react-query';
import { pollEvery, POLL } from '../polling';
import { useOptionalStaffConfig } from './context';
import { staffKeys } from './queries';
import type { StaffUnread } from './model';

export function useOptionalStaffUnread(): StaffUnread | undefined {
  const config = useOptionalStaffConfig();
  return useQuery({
    queryKey: staffKeys.unread,
    enabled: config !== null,
    queryFn: async () => {
      if (config === null) throw new Error('Messagerie externe indisponible.');
      return config.source.unread();
    },
    refetchInterval: pollEvery(POLL.unread),
    retry: false,
    staleTime: 0,
  }).data;
}

export function totalUnread(unread: StaffUnread): number {
  return unread.internal + unread.tenant + unread.owner;
}
