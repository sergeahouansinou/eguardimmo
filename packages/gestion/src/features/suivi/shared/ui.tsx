'use client';

import { Ellipsis, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Alert,
  Button,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Pagination,
  Select,
  cx,
} from '@eguardimmo/ui';
import type { SelectOption } from '@eguardimmo/ui';
import { ALL } from './biens';
import { PAGE_SIZES } from './paging';
import type { Paging } from './paging';

export interface RowAction {
  id: string;
  label: string;
  icon?: LucideIcon;
  tone?: 'default' | 'danger';
  separatorBefore?: boolean;
  onSelect: () => void;
}

export function RowMenu({ label, actions }: { label: string; actions: readonly RowAction[] }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton label={label} icon={Ellipsis} aria-haspopup="menu" />
      </MenuTrigger>
      <MenuContent width="sm">
        {actions.map((action) => (
          <div key={action.id} className="contents">
            {action.separatorBefore ? <MenuSeparator /> : null}
            <MenuItem icon={action.icon} tone={action.tone} onSelect={action.onSelect}>
              {action.label}
            </MenuItem>
          </div>
        ))}
      </MenuContent>
    </Menu>
  );
}

export function PaginationBar<T>({ paging, label }: { paging: Paging<T>; label: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 border-t border-line pt-2">
      <Pagination
        page={paging.page}
        pageSize={paging.pageSize}
        total={paging.total}
        onPageChange={paging.setPage}
        label={label}
        className="min-w-0 flex-1 border-t-0 pt-0"
      />
      <Select
        label="Lignes par page"
        placeholder="Lignes"
        hideLabel
        options={PAGE_SIZES.map((size) => ({ value: String(size), label: `${String(size)} par page` }))}
        value={String(paging.pageSize)}
        onValueChange={(value) => { paging.setPageSize(Number(value)); }}
        className="w-36"
      />
    </div>
  );
}

export function FilterSelect({
  label,
  allLabel,
  options,
  value,
  onValueChange,
  className,
}: {
  label: string;
  allLabel: string;
  options: readonly SelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}) {
  return (
    <Select
      label={label}
      placeholder={allLabel}
      options={[{ value: ALL, label: allLabel }, ...options]}
      value={value}
      onValueChange={onValueChange}
      className={cx('w-full sm:w-44', className)}
    />
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mt-1 flex flex-wrap items-end gap-2">{children}</div>;
}

export function selectionLabel(count: number, noun: string, feminine = false): string {
  const suffix = feminine ? 'e' : '';
  const plural = count > 1 ? 's' : '';
  return `${String(count)} ${noun}${plural} sélectionné${suffix}${plural}`;
}

export function BulkBar({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <div
      role="region"
      aria-label="Actions sur la sélection"
      className="flex flex-wrap items-center gap-2 rounded-md bg-action-subtle px-2 py-1.5 text-body-strong text-action-on-subtle"
    >
      <span aria-live="polite">{summary}</span>
      {children}
    </div>
  );
}

export function Notice({ message, onDismiss, tone = 'info' }: { message: string | null; onDismiss: () => void; tone?: 'info' | 'danger' }) {
  if (message === null) return null;
  return (
    <Alert tone={tone} className="items-center">
      <div className="flex items-center justify-between gap-2">
        <span>{message}</span>
        <IconButton label="Fermer le message" icon={X} size="xs" onClick={onDismiss} />
      </div>
    </Alert>
  );
}

export function FormLayout({ main, aside }: { main: ReactNode; aside?: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      {main}
      {aside ? <div className="flex min-w-0 flex-col gap-3">{aside}</div> : null}
    </div>
  );
}

export function FormActions({
  onCancel,
  submitLabel,
  pending,
}: {
  onCancel: () => void;
  submitLabel: string;
  pending: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="ghost" onClick={onCancel}>
        Annuler
      </Button>
      <Button type="submit" loading={pending}>
        {submitLabel}
      </Button>
    </div>
  );
}

export function FieldGrid({ children, columns = 2 }: { children: ReactNode; columns?: 2 | 3 }) {
  return (
    <div className={cx('grid grid-cols-1 gap-3', columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>{children}</div>
  );
}

export function countLabel(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${String(count)} ${count > 1 ? pluralForm : singular}`;
}
