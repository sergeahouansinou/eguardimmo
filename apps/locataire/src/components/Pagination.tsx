import { Button, cx } from '@eguardimmo/ui';

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-2 pt-1 text-caption text-fg-subtle">
      <span aria-live="polite">{`${String(from)} à ${String(to)} sur ${String(total)}`}</span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" disabled={page <= 1} aria-label="Page précédente" onClick={() => { onPageChange(page - 1); }}>
          ‹
        </Button>
        {Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
          <Button
            key={number}
            variant="ghost"
            size="sm"
            aria-label={`Page ${String(number)}`}
            aria-current={number === page ? 'page' : undefined}
            className={cx(number === page && 'bg-action-subtle text-action-on-subtle')}
            onClick={() => { onPageChange(number); }}
          >
            {number}
          </Button>
        ))}
        <Button variant="ghost" size="sm" disabled={page >= pages} aria-label="Page suivante" onClick={() => { onPageChange(page + 1); }}>
          ›
        </Button>
      </div>
    </nav>
  );
}
