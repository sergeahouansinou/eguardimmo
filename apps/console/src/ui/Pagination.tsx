import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton, cx } from '@eguardimmo/ui';
import { formatInteger } from '@/lib/format';

export function pageItems(page: number, pageCount: number): (number | 'gap-start' | 'gap-end')[] {
  if (pageCount <= 5) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const items: (number | 'gap-start' | 'gap-end')[] = [1];
  const from = Math.max(2, Math.min(page - 1, pageCount - 3));
  const to = Math.min(pageCount - 1, Math.max(page + 1, 4));
  if (from > 2) items.push('gap-start');
  for (let value = from; value <= to; value += 1) items.push(value);
  if (to < pageCount - 1) items.push('gap-end');
  items.push(pageCount);
  return items;
}

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-caption text-fg-subtle">
      <span aria-live="polite">
        {formatInteger(first)} à {formatInteger(last)} sur {formatInteger(total)}
      </span>
      {pageCount > 1 ? (
        <nav aria-label="Pagination" className="flex items-center gap-1">
          <IconButton
            label="Page précédente"
            icon={ChevronLeft}
            variant="secondary"
            disabled={page <= 1}
            onClick={() => { onPageChange(page - 1); }}
          />
          {pageItems(page, pageCount).map((item) =>
            typeof item === 'string' ? (
              <span key={item} aria-hidden="true" className="px-1">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                aria-label={`Page ${String(item)}`}
                aria-current={item === page ? 'page' : undefined}
                onClick={() => { onPageChange(item); }}
                className={cx(
                  'inline-flex h-7 min-w-7 items-center justify-center rounded-sm border px-1.5 text-caption tabular-nums',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                  item === page
                    ? 'border-action bg-action text-on-action'
                    : 'border-line bg-surface text-fg-muted hover:bg-muted',
                )}
              >
                {item}
              </button>
            ),
          )}
          <IconButton
            label="Page suivante"
            icon={ChevronRight}
            variant="secondary"
            disabled={page >= pageCount}
            onClick={() => { onPageChange(page + 1); }}
          />
        </nav>
      ) : null}
    </div>
  );
}
