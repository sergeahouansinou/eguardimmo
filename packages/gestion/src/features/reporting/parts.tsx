'use client';

import { Alert, Button, ConfirmDialog } from '@eguardimmo/ui';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ReportingApiError } from './api/reportingErrors';
import { useReportingPermissions } from './hooks';
import { reportingPaths } from './paths';
import { ListLoading, LoadError, PageHeader, errorMessage, useGestionNavigation } from '../locataires/kit';
import { links } from '../locataires/kit/links';

const SECTIONS = [
  { id: 'reports', label: 'Comptes rendus', href: reportingPaths.reports },
  { id: 'generate', label: 'Générer par lot', href: reportingPaths.generate },
  { id: 'statement', label: 'Relevé d’un mandant', href: reportingPaths.statement() },
] as const;

export type ReportingSection = (typeof SECTIONS)[number]['id'];

export function ReportingSections({ current }: { current: ReportingSection }) {
  const { Link } = useGestionNavigation();
  return (
    <nav aria-label="Sections des comptes rendus" className="flex flex-wrap gap-2">
      {SECTIONS.map((section) => (
        <Button key={section.id} variant={section.id === current ? 'primary' : 'secondary'} size="sm" asChild>
          <Link href={section.href} aria-current={section.id === current ? 'page' : undefined}>{section.label}</Link>
        </Button>
      ))}
    </nav>
  );
}

export function AgencyGate({ children }: { children: ReactNode }) {
  const permissions = useReportingPermissions();
  if (permissions.agency) return children;
  return (
    <>
      <PageHeader crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Comptes rendus' }]} title="Comptes rendus" />
      <Alert tone="info" title="Comptes rendus indisponibles pour ce compte">
        Les comptes rendus de gestion et les relevés de mandants sont réservés aux organisations de type agence.
      </Alert>
    </>
  );
}

export function ActionError({ title, error }: { title: string; error: unknown }) {
  const { Link } = useGestionNavigation();
  const twoFactor = error instanceof ReportingApiError && error.kind === 'two_factor_required';
  return (
    <Alert tone="danger" title={title}>
      {errorMessage(error)}
      {twoFactor ? (
        <>
          {' '}
          <Link href={reportingPaths.security} className="text-action-on-subtle underline underline-offset-2">Ouvrir Connexion et sécurité</Link>
        </>
      ) : null}
    </Alert>
  );
}

export function CardState({ query, loading, failure, children }: { query: { isPending: boolean; isError: boolean; error: Error | null }; loading: string; failure: string; children: ReactNode }) {
  if (query.isError) return <LoadError title={query.error?.message ?? failure} />;
  if (query.isPending) return <ListLoading label={loading} />;
  return children;
}

export function RoleNotice({ children }: { children: ReactNode }) {
  return <p className="text-caption text-fg-subtle">{children}</p>;
}

export function ConfirmAction({
  open,
  title,
  description,
  confirmLabel,
  failureTitle,
  tone,
  run,
  onClose,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  failureTitle: string;
  tone?: 'default' | 'danger';
  run: () => Promise<void>;
  onClose: () => void;
}) {
  const [failure, setFailure] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const close = () => {
    setFailure(null);
    onClose();
  };

  const confirm = async () => {
    setLoading(true);
    setFailure(null);
    try {
      await run();
      onClose();
    } catch (error) {
      setFailure(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => { if (!next) close(); }}
      title={title}
      description={
        <span className="flex flex-col gap-2">
          <span>{description}</span>
          {failure === null ? null : <ActionError title={failureTitle} error={failure} />}
        </span>
      }
      confirmLabel={confirmLabel}
      tone={tone ?? 'default'}
      loading={loading}
      onConfirm={() => { void confirm(); }}
    />
  );
}
