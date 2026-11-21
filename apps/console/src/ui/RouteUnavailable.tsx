import { Alert, Breadcrumb, Button } from '@eguardimmo/ui';
import type { LinkComponent } from '@eguardimmo/ui';

const AVAILABLE_SECTIONS = [
  { href: '/organisations', label: 'Organisations' },
  { href: '/support', label: 'Support' },
  { href: '/audit', label: 'Journal d’audit' },
] as const;

export interface RouteUnavailableProps {
  title: string;
  isHome?: boolean;
  note?: string;
  Link: LinkComponent;
}

export function RouteUnavailable({ title, isHome = false, note, Link }: RouteUnavailableProps) {
  return (
    <>
      <header className="flex flex-col gap-2">
        <Breadcrumb items={isHome ? [{ label: title }] : [{ label: 'Vue d’ensemble', href: '/' }, { label: title }]} Link={Link} />
        <h1 className="text-page-title">{title}</h1>
      </header>
      <Alert tone="info" title="Bientôt disponible">
        {note ?? `${title} n’est pas encore reliée au serveur.`} Aucune donnée d’exemple n’est affichée à la place.
      </Alert>
      <nav aria-label="Sections disponibles" className="flex flex-wrap gap-2">
        {isHome ? null : (
          <Button asChild variant="secondary">
            <Link href="/">Retour à la vue d’ensemble</Link>
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
