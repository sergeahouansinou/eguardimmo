'use client';

import { Alert } from '@eguardimmo/ui';
import type { ReactNode } from 'react';
import { MissingSourceError, createSourceContext } from '../../locataires/kit/sourceContext';
import { PageHeader } from '../../locataires/kit';
import { links } from '../../locataires/kit/links';
import type { TenantRequestsPermissions } from './permissions';

const context = createSourceContext<TenantRequestsPermissions>('Droits des demandes des locataires', () => {
  throw new MissingSourceError('Droits des demandes des locataires');
});

export const TenantRequestsAccessProvider = context.SourceProvider;
export const useTenantRequestsPermissions = context.useSource;

export function RoleGate({ allowed, title, crumbs, message, children }: {
  allowed: (permissions: TenantRequestsPermissions) => boolean;
  title: string;
  crumbs: readonly { label: string; href?: string }[];
  message: string;
  children: ReactNode;
}) {
  const permissions = useTenantRequestsPermissions();
  if (allowed(permissions)) return children;
  return (
    <>
      <PageHeader crumbs={[{ label: 'Accueil', href: links.home }, ...crumbs]} title={title} />
      <Alert tone="info" title="Page indisponible pour votre rôle">{message}</Alert>
    </>
  );
}

export const canManage = (permissions: TenantRequestsPermissions): boolean => permissions.manage;
export const canReadPayments = (permissions: TenantRequestsPermissions): boolean => permissions.readPayments;
