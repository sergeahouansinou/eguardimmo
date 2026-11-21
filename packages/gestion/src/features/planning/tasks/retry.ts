'use client';

import { useQueryClient } from '@tanstack/react-query';
import { PLANNING_ROOT } from '../hooks';

export function useRetryPlanning(): () => void {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: PLANNING_ROOT });
  };
}
