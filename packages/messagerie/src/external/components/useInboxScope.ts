import { useMemo, useState } from 'react';
import { useExternalConfig } from '../context';
import { useComposeOptions } from '../queries';
import type { InboxScope } from './ThreadInbox';

export function useInboxScope(): InboxScope | undefined {
  const { space } = useExternalConfig();
  const options = useComposeOptions();
  const [value, onChange] = useState<string | null>(null);
  const choices = useMemo(() => {
    const list = options.data ?? [];
    if (space === 'tenant') return list.map((option) => ({ id: option.id, label: option.label }));
    const agencies = new Map<string, string>();
    for (const option of list) agencies.set(option.agencyId, option.agencyName ?? 'Agence');
    return Array.from(agencies, ([id, label]) => ({ id, label }));
  }, [options.data, space]);
  return choices.length < 2 ? undefined : { options: choices, value, onChange };
}
