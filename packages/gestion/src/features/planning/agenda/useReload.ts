'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ORG_ROOT } from '../../orgapi/hooks';
import { PLANNING_ROOT } from '../hooks';

export function useReload(): () => void {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: PLANNING_ROOT });
    void client.invalidateQueries({ queryKey: ORG_ROOT });
  };
}
