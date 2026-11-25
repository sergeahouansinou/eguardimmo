'use client';

import { Alert } from '@eguardimmo/ui';
import Link from 'next/link';
import { PageHeader } from '@/ui/PageHeader';

export function ServerRequired({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader Link={Link} title={title} breadcrumb={[{ label: 'Vue d’ensemble', href: '/' }, { label: title }]} />
      <Alert tone="info">Cette page demande le serveur. Elle n’est pas disponible dans le mode de démonstration.</Alert>
    </div>
  );
}
