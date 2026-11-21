'use client';

import { BadgeCheck, FilePlus } from 'lucide-react';
import { LinkButton, PageHeader } from '../../locataires/kit';
import { links } from '../../locataires/kit/links';
import { DocumentsPage as ConformiteJustificatifs } from '../DocumentsPage';
import { useLibraryPermissions } from './hooks';
import { LibraryList } from './LibraryList';
import { libraryPaths } from './paths';

export function LibraryPage({ mandateLabelOf }: { mandateLabelOf?: (mandateId: string) => string | null }) {
  const permissions = useLibraryPermissions();
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Documents' }]}
        title="Documents"
        subtitle="Mandats, baux, diagnostics et photos déposés par l’agence, puis justificatifs de conformité."
        actions={
          <>
            <LinkButton href={libraryPaths.certificates} icon={BadgeCheck}>Conformité</LinkButton>
            {permissions.write ? <LinkButton href={libraryPaths.add} variant="primary" icon={FilePlus}>Ajouter un document</LinkButton> : null}
          </>
        }
      />
      <section aria-labelledby="library-title" className="flex flex-col gap-2">
        <h2 id="library-title" className="text-block-title text-fg">Bibliothèque</h2>
        <LibraryList {...(mandateLabelOf ? { mandateLabelOf } : {})} />
      </section>
      <section aria-labelledby="conformity-files-title" className="flex flex-col gap-2">
        <h2 id="conformity-files-title" className="text-block-title text-fg">Justificatifs de conformité</h2>
        <ConformiteJustificatifs embedded />
      </section>
    </>
  );
}
