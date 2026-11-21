'use client';

import { Button } from '@eguardimmo/ui';
import { useGestionNavigation } from '../../locataires/kit';
import { rentPaths } from './paths';

const SECTIONS = [
  { id: 'installments', label: 'Échéances', href: rentPaths.installments },
  { id: 'payments', label: 'Paiements', href: rentPaths.payments },
  { id: 'receipts', label: 'Quittances', href: rentPaths.receipts },
] as const;

export type RentSection = (typeof SECTIONS)[number]['id'];

export function RentSections({ current }: { current: RentSection }) {
  const { Link } = useGestionNavigation();
  return (
    <nav aria-label="Sections des loyers" className="flex flex-wrap gap-2">
      {SECTIONS.map((section) => (
        <Button key={section.id} variant={section.id === current ? 'primary' : 'secondary'} size="sm" asChild>
          <Link href={section.href} aria-current={section.id === current ? 'page' : undefined}>{section.label}</Link>
        </Button>
      ))}
    </nav>
  );
}
