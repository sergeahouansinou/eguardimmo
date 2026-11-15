import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton, Select, cx } from '@eguardimmo/ui';
import { pageNumbers } from './filters';

export const PAGE_SIZES = [10, 25, 50] as const;

export interface JournalFooterProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function JournalFooter({ page, pageSize, total, onPageChange, onPageSizeChange }: JournalFooterProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-2">
      <span className="text-caption text-fg-subtle" aria-live="polite">{`${String(first)} à ${String(last)} sur ${String(total)}`}</span>
      <div className="flex flex-wrap items-center gap-3">
        <Select
          label="Lignes par page"
          placeholder="25"
          hideLabel
          className="w-[168px]"
          value={String(pageSize)}
          options={PAGE_SIZES.map((size) => ({ value: String(size), label: `Lignes par page ${String(size)}` }))}
          onValueChange={(value) => { onPageSizeChange(Number(value)); }}
        />
        <nav aria-label="Pagination du journal" className="flex items-center gap-1">
          <IconButton label="Page précédente" icon={ChevronLeft} disabled={page <= 1} onClick={() => { onPageChange(page - 1); }} />
          {pageNumbers(page, pageCount).map((entry, index) =>
            entry === null ? (
              <span key={`gap-${String(index)}`} aria-hidden="true" className="px-1 text-caption text-fg-subtle">
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                aria-label={`Page ${String(entry)}`}
                aria-current={entry === page ? 'page' : undefined}
                onClick={() => { onPageChange(entry); }}
                className={cx(
                  'inline-flex size-7 items-center justify-center rounded-sm text-caption tabular-nums',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                  entry === page ? 'bg-action-subtle font-semibold text-action-on-subtle' : 'text-fg-muted hover:bg-muted',
                )}
              >
                {entry}
              </button>
            ),
          )}
          <IconButton label="Page suivante" icon={ChevronRight} disabled={page >= pageCount} onClick={() => { onPageChange(page + 1); }} />
        </nav>
      </div>
    </div>
  );
}
