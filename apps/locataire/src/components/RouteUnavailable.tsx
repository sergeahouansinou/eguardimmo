'use client';

import { Alert, Breadcrumb, Button } from '@eguardimmo/ui';
import Link from 'next/link';
import type { UnavailableLink } from '@/espace/unavailableCopy';

const AVAILABLE_SECTIONS: readonly UnavailableLink[] = [
  { href: '/bail', label: 'Mes baux' },
  { href: '/acces', label: 'Mes accès' },
  { href: '/aide', label: 'Aide' },
];

interface RouteUnavailableProps {
  title: string;
  alertTitle?: string;
  description?: string;
  links?: readonly UnavailableLink[];
}

export function RouteUnavailable({ title, alertTitle = 'Bientôt disponible', description, links = [] }: RouteUnavailableProps) {
  const sections = [...links, ...AVAILABLE_SECTIONS];
  return (
    <>
      <header className="flex flex-col gap-2">
        <Breadcrumb items={[{ label: 'Accueil', href: '/' }, { label: title }]} Link={Link} />
        <h1 className="text-page-title">{title}</h1>
      </header>
      <Alert tone="info" title={alertTitle}>
        {description ?? `${title} n’est pas encore relié au serveur. Aucune donnée d’exemple n’est affichée à la place.`}
      </Alert>
      <nav aria-label="Sections disponibles" className="flex flex-wrap gap-2">
        <Button asChild variant="secondary">
          <Link href="/">Retour à l’accueil</Link>
        </Button>
        {sections.map((section) => (
          <Button key={section.href} asChild variant="secondary">
            <Link href={section.href}>{section.label}</Link>
          </Button>
        ))}
      </nav>
    </>
  );
}
