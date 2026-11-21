'use client';

import { Alert, Button } from '@eguardimmo/ui';
import type { ReactNode } from 'react';
import { PageHeader, useGestionNavigation } from '../../../locataires/kit';
import { links } from '../../../locataires/kit/links';
import { useBankingPermissions } from '../hooks';
import { bankingPaths } from '../paths';

const SECTIONS = [
  { id: 'lines', label: 'Pointage', href: bankingPaths.lines },
  { id: 'accounts', label: 'Comptes bancaires', href: bankingPaths.accounts },
  { id: 'statements', label: 'Relevés', href: bankingPaths.statements },
  { id: 'reconciliations', label: 'États de rapprochement', href: bankingPaths.reconciliations },
] as const;

export type BankingSection = (typeof SECTIONS)[number]['id'];

export function BankingSections({ current }: { current: BankingSection }) {
  const { Link } = useGestionNavigation();
  return (
    <nav aria-label="Sections du rapprochement bancaire" className="flex flex-wrap gap-2">
      {SECTIONS.map((section) => (
        <Button key={section.id} variant={section.id === current ? 'primary' : 'secondary'} size="sm" asChild>
          <Link href={section.href} aria-current={section.id === current ? 'page' : undefined}>{section.label}</Link>
        </Button>
      ))}
    </nav>
  );
}

export function BankingGate({ children }: { children: ReactNode }) {
  const permissions = useBankingPermissions();
  if (permissions.available) return children;
  return (
    <>
      <PageHeader crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Banque' }]} title="Rapprochement bancaire" />
      <Alert tone="info" title="Banque indisponible pour ce compte">
        Le pointage des relevés et le rapprochement bancaire sont réservés au titulaire, à l’administrateur et au comptable de l’organisation.
      </Alert>
    </>
  );
}
