'use client';

import type { ReactNode } from 'react';
import { useLeases } from './hooks';
import { bauxPaths } from './paths';
import type { Lease } from './schemas';
import { ListLoading, LoadError, NotFoundPanel, PageHeader } from '../locataires/kit';
import { links } from '../locataires/kit/links';

export function LeaseGate({ id, title, children }: { id: string; title: string; children: (lease: Lease) => ReactNode }) {
  const leases = useLeases();
  const crumbs = [{ label: 'Accueil', href: links.home }, { label: 'Baux', href: bauxPaths.list }];
  if (leases.isError) {
    return (
      <>
        <PageHeader crumbs={[...crumbs, { label: title }]} title={title} />
        <LoadError title="Le bail n’a pas pu être chargé" />
      </>
    );
  }
  if (!leases.data) {
    return (
      <>
        <PageHeader crumbs={[...crumbs, { label: title }]} title={title} />
        <ListLoading label="Chargement du bail" />
      </>
    );
  }
  const lease = leases.data.find((entry) => entry.id === id);
  if (!lease) {
    return (
      <>
        <PageHeader crumbs={[...crumbs, { label: 'Introuvable' }]} title="Bail introuvable" />
        <NotFoundPanel title="Ce bail n’existe pas" description="Il a peut-être été supprimé ou le lien est incorrect." backHref={bauxPaths.list} backLabel="Retour aux baux" />
      </>
    );
  }
  return <>{children(lease)}</>;
}
