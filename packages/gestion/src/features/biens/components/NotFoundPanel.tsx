'use client';

import { Button, EmptyState } from '@eguardimmo/ui';
import { SearchX } from 'lucide-react';
import { useBiensEnvironment } from '../environment';

export function NotFoundPanel({ title, backHref, backLabel }: { title: string; backHref: string; backLabel: string }) {
  const { Link } = useBiensEnvironment();
  return (
    <EmptyState icon={SearchX} title={title} description="Il a peut-être été supprimé, ou l’adresse est incorrecte.">
      <Button variant="secondary" asChild>
        <Link href={backHref}>{backLabel}</Link>
      </Button>
    </EmptyState>
  );
}
