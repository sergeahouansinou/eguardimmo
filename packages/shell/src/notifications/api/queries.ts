'use client';

import { ApiError, ApiUnreachableError } from '@eguardimmo/api';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationsApi, PreferenceChange } from './model';
import {
  fetchNotificationPage,
  fetchPreferences,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  savePreferences,
} from './requests';

export const POLL_INTERVAL_MS = 60_000;
const COUNT_STALE_MS = 15_000;
const BELL_PAGE_SIZE = 8;
const FEED_PAGE_SIZE = 20;

const scope = (api: NotificationsApi) => ['api', 'notifications', 'list', api.organizationId ?? 'tenant'] as const;

export const notificationKeys = {
  count: (api: NotificationsApi) => [...scope(api), 'count'] as const,
  bell: (api: NotificationsApi, unreadOnly: boolean) => [...scope(api), 'bell', unreadOnly] as const,
  feed: (api: NotificationsApi, unreadOnly: boolean) => [...scope(api), 'feed', unreadOnly] as const,
  scope,
  preferences: ['api', 'notifications', 'preferences'] as const,
};

function retryTransient(failureCount: number, error: unknown): boolean {
  const transient = error instanceof ApiUnreachableError || (error instanceof ApiError && error.status >= 500);
  return transient && failureCount < 2;
}

export function useUnreadCount(api: NotificationsApi) {
  return useQuery({
    queryKey: notificationKeys.count(api),
    queryFn: () => fetchUnreadCount(api),
    staleTime: COUNT_STALE_MS,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (query.state.status === 'error' ? false : POLL_INTERVAL_MS),
    retry: retryTransient,
  });
}

export function useBellNotifications(api: NotificationsApi, unreadOnly: boolean, enabled: boolean) {
  return useQuery({
    queryKey: notificationKeys.bell(api, unreadOnly),
    queryFn: () => fetchNotificationPage(api, { unreadOnly, cursor: null, perPage: BELL_PAGE_SIZE }),
    enabled,
    staleTime: 0,
    retry: retryTransient,
  });
}

export function useNotificationFeed(api: NotificationsApi, unreadOnly: boolean) {
  return useInfiniteQuery({
    queryKey: notificationKeys.feed(api, unreadOnly),
    queryFn: ({ pageParam }) => fetchNotificationPage(api, { unreadOnly, cursor: pageParam, perPage: FEED_PAGE_SIZE }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    retry: retryTransient,
  });
}

export function useMarkNotificationRead(api: NotificationsApi) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(api, id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: scope(api) }),
  });
}

export function useMarkAllNotificationsRead(api: NotificationsApi) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(api),
    onSettled: () => queryClient.invalidateQueries({ queryKey: scope(api) }),
  });
}

export function useNotificationPreferences(api: NotificationsApi) {
  return useQuery({ queryKey: notificationKeys.preferences, queryFn: () => fetchPreferences(api), retry: retryTransient });
}

export function useSaveNotificationPreferences(api: NotificationsApi) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: PreferenceChange[]) => savePreferences(api, changes),
    onSuccess: (types) => {
      queryClient.setQueryData(notificationKeys.preferences, types);
    },
  });
}
