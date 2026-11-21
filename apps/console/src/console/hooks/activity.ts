'use client';

import { activityEntrySchema, activityListSchema } from '../schemas';
import type { ActivityEntry, ActivityList, ActivityQuery } from '../schemas';
import { useConsoleQuery } from './core';
import type { ConsoleQuery } from './core';

export const useActivityList = (query: ActivityQuery): ConsoleQuery<ActivityList> =>
  useConsoleQuery(['activity', 'list', query], (source) => source.activity.list(query), activityListSchema, { keepPrevious: true });

export const useActivityEntry = (id: string): ConsoleQuery<ActivityEntry> =>
  useConsoleQuery(['activity', 'detail', id], (source) => source.activity.get(id), activityEntrySchema);
