'use client';

import { useState } from 'react';
import { useOrgTimezone } from '../orgapi/hooks';
import { todayIn } from '../orgapi/zone';
import type { Period } from './model';
import { defaultMonths, periodOf } from './period';
import type { PeriodFormValues } from './period';

export function usePeriod(): { ready: boolean; initial: PeriodFormValues; period: Period | null; apply: (values: PeriodFormValues) => void; zonePending: boolean; timezone: ReturnType<typeof useOrgTimezone> } {
  const timezone = useOrgTimezone();
  const [applied, setApplied] = useState<PeriodFormValues | null>(null);
  const defaults = timezone.data === undefined ? null : defaultMonths(todayIn(timezone.data));
  const current = applied ?? defaults;
  return {
    ready: current !== null,
    initial: current ?? { fromMonth: '', toMonth: '' },
    period: current === null ? null : periodOf(current.fromMonth, current.toMonth),
    apply: setApplied,
    zonePending: timezone.isPending,
    timezone,
  };
}
