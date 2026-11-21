'use client';

import { Alert, Button, ConfirmDialog, Dialog, DialogClose, DialogContent, Textarea } from '@eguardimmo/ui';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { OwnerFundsApiError } from './api/ownerFundsErrors';
import { useOwnerFundsPermissions } from './hooks';
import { ownerFundsPaths } from './paths';
import { PageHeader, errorMessage, useGestionNavigation } from '../../locataires/kit';
import { links } from '../../locataires/kit/links';

const SECTIONS = [
  { id: 'payouts', label: 'Reversements', href: ownerFundsPaths.payouts },
  { id: 'accounts', label: 'Changements d’IBAN', href: ownerFundsPaths.requests },
  { id: 'fees', label: 'Honoraires', href: ownerFundsPaths.fees },
  { id: 'trust', label: 'Fonds de tiers', href: ownerFundsPaths.trust },
  { id: 'closing', label: 'Clôture mensuelle', href: ownerFundsPaths.closing },
] as const;

export type OwnerFundsSection = (typeof SECTIONS)[number]['id'];

export function OwnerFundsSections({ current }: { current: OwnerFundsSection }) {
  const { Link } = useGestionNavigation();
  return (
    <nav aria-label="Sections des fonds des mandants" className="flex flex-wrap gap-2">
      {SECTIONS.map((section) => (
        <Button key={section.id} variant={section.id === current ? 'primary' : 'secondary'} size="sm" asChild>
          <Link href={section.href} aria-current={section.id === current ? 'page' : undefined}>{section.label}</Link>
        </Button>
      ))}
    </nav>
  );
}

export function OwnerFundsGate({ children }: { children: ReactNode }) {
  const permissions = useOwnerFundsPermissions();
  if (permissions.available) return children;
  return (
    <>
      <PageHeader crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Fonds des mandants' }]} title="Fonds des mandants" />
      <Alert tone="info" title="Fonds des mandants indisponibles pour ce compte">
        Reversements, honoraires, fonds de tiers et clôture mensuelle sont réservés aux organisations de type agence.
      </Alert>
    </>
  );
}

export function ActionError({ title, error }: { title: string; error: unknown }) {
  const { Link } = useGestionNavigation();
  const twoFactor = error instanceof OwnerFundsApiError && error.kind === 'two_factor_required';
  return (
    <Alert tone="danger" title={title}>
      {errorMessage(error)}
      {twoFactor ? (
        <>
          {' '}
          <Link href={ownerFundsPaths.security} className="text-action-on-subtle underline underline-offset-2">Ouvrir Connexion et sécurité</Link>
        </>
      ) : null}
    </Alert>
  );
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

export function ReasonDialog({
  open,
  title,
  description,
  confirmLabel,
  failureTitle,
  placeholder = 'Ex. virement refusé par la banque',
  run,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  failureTitle: string;
  placeholder?: string;
  run: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title={title} description={description} className="max-w-[480px]">
        {open ? <ReasonForm confirmLabel={confirmLabel} failureTitle={failureTitle} placeholder={placeholder} run={run} onDone={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ReasonForm({ confirmLabel, failureTitle, placeholder, run, onDone }: { confirmLabel: string; failureTitle: string; placeholder: string; run: (reason: string) => Promise<void>; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const trimmed = reason.trim();
  const valid = trimmed.length >= 3 && trimmed.length <= 500;
  const error = touched && !valid ? 'Indiquez un motif de 3 à 500 caractères.' : undefined;

  const submit = async () => {
    setTouched(true);
    if (!valid) return;
    setLoading(true);
    setFailure(null);
    try {
      await run(trimmed);
      onDone();
    } catch (caught) {
      setFailure(caught);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-3 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void submit();
      }}
    >
      <Textarea label="Motif *" placeholder={placeholder} rows={3} value={reason} error={error} onChange={(event) => { setReason(event.target.value); }} onBlur={() => { setTouched(true); }} data-autofocus />
      {failure === null ? null : <ActionError title={failureTitle} error={failure} />}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button type="submit" variant="danger" loading={loading}>{confirmLabel}</Button>
      </div>
    </form>
  );
}
