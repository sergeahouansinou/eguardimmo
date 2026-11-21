'use client';

import { Alert, Badge } from '@eguardimmo/ui';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { LinkButton, ListLoading, PageHeader, useGestionNavigation } from '../locataires/kit';
import { useDirectoryPermissions } from './hooks';
import type { PropertyLink } from './model';
import { directoryPaths } from './paths';

export const DIRECTORY_CRUMBS = [{ label: 'Accueil', href: directoryPaths.home }, { label: 'Contacts', href: directoryPaths.contacts }] as const;

export function DirectoryGate({ need, title, children }: { need: 'read' | 'write'; title: string; children: ReactNode }) {
  const permissions = useDirectoryPermissions();
  if (permissions.pending) return <ListLoading label="Vérification de vos droits" />;
  if (permissions.read && (need === 'read' || permissions.write)) return children;
  return (
    <>
      <PageHeader crumbs={DIRECTORY_CRUMBS} title={title} />
      <Alert tone="info" title="Accès refusé">
        {permissions.read ? 'Votre rôle permet de consulter les contacts, pas de les modifier.' : 'Votre rôle ne donne pas accès aux contacts de cette organisation.'}
      </Alert>
      <div>
        <LinkButton href={directoryPaths.contacts}>Retour aux contacts</LinkButton>
      </div>
    </>
  );
}

export function UnitCell({ link }: { link: Pick<PropertyLink, 'unitId' | 'unitReference'> }) {
  const { Link } = useGestionNavigation();
  if (link.unitId === null) return 'Tout le bien';
  return <Link href={directoryPaths.unit(link.unitId)} className="text-action-on-subtle underline-offset-2 hover:underline">{link.unitReference ?? 'Voir le lot'}</Link>;
}

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => { setSettled(value); }, delayMs);
    return () => { clearTimeout(timer); };
  }, [value, delayMs]);
  return settled;
}

export function ContactBadges({ anonymized, archived, account }: { anonymized: boolean; archived: boolean; account?: boolean }) {
  return (
    <>
      {anonymized ? <Badge tone="neutral">Anonymisé</Badge> : null}
      {archived ? <Badge tone="warning">Archivé</Badge> : null}
      {account ? <Badge tone="info">Compte rattaché</Badge> : null}
    </>
  );
}
