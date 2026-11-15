'use client';

import type { BreadcrumbItem } from '@eguardimmo/ui';
import type { ReactNode } from 'react';
import { ListLoading, LoadError, NotFoundPanel, PageHeader } from '../locataires/kit';

export function RecordGate<T>({
  query,
  find,
  crumbs,
  title,
  missing,
  children,
}: {
  query: { data: readonly T[] | undefined; isError: boolean };
  find: (item: T) => boolean;
  crumbs: readonly BreadcrumbItem[];
  title: string;
  missing: { title: string; description: string; backHref: string; backLabel: string };
  children: (record: T) => ReactNode;
}) {
  if (query.isError) {
    return (
      <>
        <PageHeader crumbs={[...crumbs, { label: title }]} title={title} />
        <LoadError title="Le document n’a pas pu être chargé" />
      </>
    );
  }
  if (!query.data) {
    return (
      <>
        <PageHeader crumbs={[...crumbs, { label: title }]} title={title} />
        <ListLoading label="Chargement du document" />
      </>
    );
  }
  const record = query.data.find(find);
  if (!record) {
    return (
      <>
        <PageHeader crumbs={[...crumbs, { label: 'Introuvable' }]} title={missing.title} />
        <NotFoundPanel title={missing.title} description={missing.description} backHref={missing.backHref} backLabel={missing.backLabel} />
      </>
    );
  }
  return <>{children(record)}</>;
}
