'use client';

import type { NotificationTypeSetting, Reminder, ReminderInput, TypeChange } from '@/platform/notificationSettings/notificationSettings';
import { usePlatformMutation, usePlatformQuery } from '@/platform/context';
import type { PlatformQuery } from '@/platform/context';

export const useReminders = (): PlatformQuery<Reminder[]> =>
  usePlatformQuery(['notification-settings', 'reminders'], (api) => api.notificationSettings.reminders());

export const useUpdateReminder = () =>
  usePlatformMutation((api, { code, input }: { code: string; input: ReminderInput }) => api.notificationSettings.updateReminder(code, input));

export const useNotificationTypes = (): PlatformQuery<NotificationTypeSetting[]> =>
  usePlatformQuery(['notification-settings', 'types'], (api) => api.notificationSettings.types());

export const useUpdateNotificationTypes = () => usePlatformMutation((api, changes: TypeChange[]) => api.notificationSettings.updateTypes(changes));
