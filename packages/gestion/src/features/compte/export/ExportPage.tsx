'use client';

import { ShieldCheck } from 'lucide-react';
import { Alert } from '@eguardimmo/ui';
import { PageHeader } from '../../outils/kit';
import type { ScreenProps } from '../../outils/kit';
import { ExportHistory } from './ExportHistory';
import { ExportRequestCard } from './ExportRequestCard';

export function ExportPage({ Link }: ScreenProps) {
  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Mon compte', href: '/compte' }, { label: 'Exporter mes données' }]}
        title="Exporter mes données"
        description="Récupérez une copie de vos données dans un format réutilisable."
      />
      <Alert tone="info" title="Archive de démonstration">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck size={14} aria-hidden="true" />
          Le téléchargement fournit un fichier simulé : aucune donnée réelle n’est incluse dans cette version.
        </span>
      </Alert>
      <div className="grid grid-cols-1 gap-4">
        <ExportRequestCard />
        <ExportHistory />
      </div>
    </>
  );
}
