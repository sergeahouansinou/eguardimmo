'use client';

import { Button, Icon } from '@eguardimmo/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

export interface CursorPages {
  cursor: string | null;
  page: number;
  next: (cursor: string) => void;
  previous: () => void;
  reset: () => void;
}

export function useCursorPages(): CursorPages {
  const [stack, setStack] = useState<readonly string[]>([]);
  return {
    cursor: stack.at(-1) ?? null,
    page: stack.length + 1,
    next: (cursor) => { setStack((current) => [...current, cursor]); },
    previous: () => { setStack((current) => current.slice(0, -1)); },
    reset: () => { setStack([]); },
  };
}

export function CursorPager({ pages, nextCursor, label }: { pages: CursorPages; nextCursor: string | null; label: string }) {
  if (pages.page === 1 && nextCursor === null) return null;
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
      <span className="text-caption text-fg-subtle" aria-live="polite">{`Page ${String(pages.page)}`}</span>
      <span className="flex items-center gap-1">
        <Button variant="ghost" size="sm" disabled={pages.page <= 1} onClick={pages.previous}>
          <Icon icon={ChevronLeft} />
          Précédent
        </Button>
        <Button variant="ghost" size="sm" disabled={nextCursor === null} onClick={() => { if (nextCursor !== null) pages.next(nextCursor); }}>
          Suivant
          <Icon icon={ChevronRight} />
        </Button>
      </span>
    </nav>
  );
}
