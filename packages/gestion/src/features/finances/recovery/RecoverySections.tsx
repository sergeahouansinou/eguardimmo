'use client';

import { Button } from '@eguardimmo/ui';
import { useGestionNavigation } from '../../locataires/kit';
import { recoveryPaths } from './paths';

const SECTIONS = [
  { id: 'unpaid', label: 'Impayés', href: recoveryPaths.unpaid },
  { id: 'cases', label: 'Dossiers de recouvrement', href: recoveryPaths.cases },
] as const;

export type RecoverySection = (typeof SECTIONS)[number]['id'];

export function RecoverySections({ current }: { current: RecoverySection }) {
  const { Link } = useGestionNavigation();
  return (
    <nav aria-label="Sections du recouvrement" className="flex flex-wrap gap-2">
      {SECTIONS.map((section) => (
        <Button key={section.id} variant={section.id === current ? 'primary' : 'secondary'} size="sm" asChild>
          <Link href={section.href} aria-current={section.id === current ? 'page' : undefined}>{section.label}</Link>
        </Button>
      ))}
    </nav>
  );
}
