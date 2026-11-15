import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import { cx } from '../../lib/cx';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  label?: string;
  className?: string;
}

export function Pagination({ page, pageSize, total, onPageChange, label = 'Pagination', className }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <nav aria-label={label} className={cx('flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2', className)}>
      <span className="text-caption text-fg-subtle" aria-live="polite">
        {`${String(first)} à ${String(last)} sur ${String(total)}`}
      </span>
      {pageCount > 1 ? (
        <span className="flex items-center gap-1">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => { onPageChange(page - 1); }}>
            <Icon icon={ChevronLeft} />
            Précédent
          </Button>
          <Button variant="ghost" size="sm" disabled={page >= pageCount} onClick={() => { onPageChange(page + 1); }}>
            Suivant
            <Icon icon={ChevronRight} />
          </Button>
        </span>
      ) : null}
    </nav>
  );
}
