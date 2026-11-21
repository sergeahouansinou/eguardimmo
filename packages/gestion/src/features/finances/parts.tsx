'use client';

import { Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Badge, Breadcrumb, Button, Icon, Pagination, TextField } from '@eguardimmo/ui';
import type { BadgeTone, BreadcrumbItem, LinkComponent } from '@eguardimmo/ui';
import { formatMoney } from '../../format/money';
import type { Currency } from '../../format/money';
import type { EcheanceEtat } from './derive';
import { pushFlash, FlashAlert } from './flash';
import { useFinancesCommand } from './queries';
import type { CommandResult } from './commands';
import type { CommandDraft, FinancesQuery } from './queries';

export interface ScreenProps {
  Link: LinkComponent;
  navigate: (href: string) => void;
}

export const FINANCES_ROUTES = {
  operations: '/finances',
  impayes: '/finances/impayes',
  factures: '/finances/factures',
  nouvelleFacture: '/finances/factures/nouvelle',
  regularisation: '/finances/regularisation',
  bilan: '/finances/bilan',
  prets: '/finances/prets',
  importBancaire: '/finances/import-bancaire',
  encaisser: '/finances/encaissements/nouveau',
  acompte: '/finances/encaissements/acompte',
  depense: '/finances/depenses/nouvelle',
} as const;

export const PAGE_SIZE = 10;

export function PageHeader({
  Link,
  crumbs,
  title,
  description,
  actions,
}: {
  Link: LinkComponent;
  crumbs: readonly BreadcrumbItem[];
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <>
      <Breadcrumb items={crumbs} Link={Link} />
      <FlashAlert />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-page-title [overflow-wrap:anywhere]">{title}</h1>
          {description ? <p className="mt-0.5 text-body text-fg-muted [overflow-wrap:anywhere]">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </>
  );
}

export function LoadingBlock({ label = 'Chargement' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-2">
      {[0, 1, 2].map((row) => (
        <div key={row} aria-hidden="true" className="h-9 animate-pulse rounded-sm bg-muted" />
      ))}
    </div>
  );
}

export function EmptyBlock({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1.5 rounded-lg border border-dashed border-line-control p-4">
      <p className="text-empty-title text-fg">{title}</p>
      {children ? <p className="text-body text-fg-muted">{children}</p> : null}
      {action}
    </div>
  );
}

export function QueryGate({
  query,
  errorTitle,
  children,
}: {
  query: FinancesQuery;
  errorTitle: string;
  children: (data: NonNullable<FinancesQuery['data']>) => ReactNode;
}) {
  if (query.isError) {
    return (
      <Alert tone="danger" title={errorTitle}>
        <span className="flex flex-wrap items-center gap-2">
          Vérifiez votre connexion puis réessayez.
          <Button variant="link" size="sm" onClick={query.refetch}>
            Réessayer
          </Button>
        </span>
      </Alert>
    );
  }
  if (query.data === undefined) return <LoadingBlock />;
  return <>{children(query.data)}</>;
}

export function NotFoundBlock({ Link, title, backHref, backLabel }: { Link: LinkComponent; title: string; backHref: string; backLabel: string }) {
  return (
    <EmptyBlock
      title={title}
      action={
        <Button variant="secondary" asChild>
          <Link href={backHref}>{backLabel}</Link>
        </Button>
      }
    >
      Cet élément n’existe pas ou n’est plus disponible.
    </EmptyBlock>
  );
}

export function CommandAlert({ error }: { error: Error | null }) {
  if (!error) return null;
  return (
    <Alert tone="danger" title="L’opération n’a pas été enregistrée">
      {error.message}
    </Alert>
  );
}

const ETAT_BADGES: Record<EcheanceEtat, { label: string; tone: BadgeTone }> = {
  retard: { label: 'Retard', tone: 'danger' },
  partiel: { label: 'Partiel', tone: 'warning' },
  trop_percu: { label: 'Trop perçu', tone: 'neutral' },
  solde: { label: 'Soldé', tone: 'success' },
  a_venir: { label: 'À venir', tone: 'info' },
  annulee: { label: 'Annulé', tone: 'neutral' },
  irrecouvrable: { label: 'Irrécouvrable', tone: 'danger' },
};

export function EtatBadge({ etat, jours }: { etat: EcheanceEtat; jours: number }) {
  const badge = ETAT_BADGES[etat];
  const label = etat === 'retard' ? `Retard, ${String(jours)} jour${jours > 1 ? 's' : ''}` : badge.label;
  return <Badge tone={badge.tone}>{label}</Badge>;
}

export function useMoney(currency: Currency | undefined) {
  return (minor: number, signed = false) => formatMoney(minor, currency ?? 'EUR', { signed });
}

export function useExec({ navigate }: Pick<ScreenProps, 'navigate'>) {
  const mutation = useFinancesCommand();
  const run = (
    command: CommandDraft,
    options: { requestKey?: string; redirect?: string; onDone?: (result: CommandResult) => void; onError?: () => void } = {},
  ) => {
    mutation.mutate(
      { command, requestKey: options.requestKey },
      {
        onSuccess: (result) => {
          pushFlash(result.message);
          options.onDone?.(result);
          const target = options.redirect === 'result' ? result.href : options.redirect;
          if (target) navigate(target);
        },
        onError: () => {
          options.onError?.();
        },
      },
    );
  };
  return { run, pending: mutation.isPending, error: mutation.error, reset: mutation.reset };
}

export function MoneyField({
  label,
  value,
  onChange,
  error,
  hint,
  placeholder = '850',
  readOnly,
  id,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  readOnly?: boolean;
  id?: string;
}) {
  return (
    <TextField
      id={id}
      label={label}
      value={value}
      inputMode="decimal"
      placeholder={placeholder}
      error={error}
      hint={hint}
      readOnly={readOnly}
      onChange={(event) => {
        onChange?.(event.target.value);
      }}
    />
  );
}

export function DateField({
  label,
  value,
  onChange,
  error,
  hint,
  id,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  id?: string;
}) {
  return (
    <TextField
      id={id}
      type="date"
      label={label}
      value={value}
      placeholder="JJ/MM/AAAA"
      error={error}
      hint={hint}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  );
}

export function useSelection() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  return {
    selected,
    toggle: (id: string) => {
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    setAll: (ids: readonly string[], checked: boolean) => {
      setSelected(checked ? new Set(ids) : new Set());
    },
    clear: () => {
      setSelected(new Set());
    },
  };
}

export function FilePicker({
  label,
  accept,
  onPick,
  disabled,
  variant = 'secondary',
}: {
  label: string;
  accept: string;
  onPick: (file: File) => void;
  disabled?: boolean;
  variant?: 'secondary' | 'link';
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={accept}
        tabIndex={-1}
        aria-label={label}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onPick(file);
        }}
      />
      <Button
        variant={variant}
        size="sm"
        disabled={disabled}
        onClick={() => {
          input.current?.click();
        }}
      >
        <Icon icon={Upload} />
        {label}
      </Button>
    </>
  );
}

export function PagedFooter({ page, total, onPageChange, label, extra }: { page: number; total: number; onPageChange: (page: number) => void; label: string; extra?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={onPageChange} label={label} />
      {extra ? <p className="text-caption text-fg-subtle">{extra}</p> : null}
    </div>
  );
}
