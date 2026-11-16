'use client';

import { Alert, Breadcrumb, Button } from '@eguardimmo/ui';
import type { LinkComponent } from '@eguardimmo/ui';

const AVAILABLE_SECTIONS = [
  { href: '/biens', label: 'Biens' },
  { href: '/locataires', label: 'Locataires' },
  { href: '/baux', label: 'Baux' },
  { href: '/messages', label: 'Messages' },
  { href: '/equipe', label: 'Équipe' },
] as const;

export interface RouteUnavailableProps {
  title: string;
  isHome?: boolean;
  Link: LinkComponent;
}

export function RouteUnavailable({ title, isHome = false, Link }: RouteUnavailableProps) {
  return (
    <>
      <header className="flex flex-col gap-2">
        <Breadcrumb items={isHome ? [{ label: title }] : [{ label: 'Accueil', href: '/' }, { label: title }]} Link={Link} />
        <h1 className="text-page-title">{title}</h1>
      </header>
      <Alert tone="info" title="Bientôt disponible">
        {title} n’est pas encore reliée au serveur. Aucune donnée d’exemple n’est affichée à la place.
      </Alert>
      <nav aria-label="Sections disponibles" className="flex flex-wrap gap-2">
        {isHome ? null : (
          <Button asChild variant="secondary">
            <Link href="/">Retour à l’accueil</Link>
          </Button>
        )}
        {AVAILABLE_SECTIONS.map((section) => (
          <Button key={section.href} asChild variant="secondary">
            <Link href={section.href}>{section.label}</Link>
          </Button>
        ))}
      </nav>
    </>
  );
}
