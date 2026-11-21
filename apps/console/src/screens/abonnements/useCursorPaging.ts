'use client';

import { useState } from 'react';

export interface CursorPaging {
  cursor: string | undefined;
  page: number;
  canGoBack: boolean;
  next: (cursor: string) => void;
  previous: () => void;
  reset: () => void;
}

export function useCursorPaging(): CursorPaging {
  const [cursors, setCursors] = useState<string[]>([]);
  return {
    cursor: cursors.at(-1),
    page: cursors.length + 1,
    canGoBack: cursors.length > 0,
    next: (cursor) => { setCursors((current) => [...current, cursor]); },
    previous: () => { setCursors((current) => current.slice(0, -1)); },
    reset: () => { setCursors([]); },
  };
}
