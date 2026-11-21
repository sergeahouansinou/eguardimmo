import { Button } from '@eguardimmo/ui';
import type { CursorPaging } from './useCursorPaging';

export interface CursorPagerProps {
  paging: CursorPaging;
  hasMore: boolean;
  nextCursor: string | null;
}

export function CursorPager({ paging, hasMore, nextCursor }: CursorPagerProps) {
  if (!paging.canGoBack && !hasMore) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-2 pt-1 text-caption text-fg-subtle">
      <span aria-live="polite">Page {paging.page}</span>
      <span className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={!paging.canGoBack} onClick={paging.previous}>
          Page précédente
        </Button>
        <Button variant="secondary" size="sm" disabled={!hasMore || nextCursor === null} onClick={() => { if (nextCursor !== null) paging.next(nextCursor); }}>
          Page suivante
        </Button>
      </span>
    </nav>
  );
}
