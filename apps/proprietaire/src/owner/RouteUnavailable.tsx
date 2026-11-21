"use client";

import { Alert, Breadcrumb, Button } from "@eguardimmo/ui";
import Link from "next/link";
import { confieRoutes } from "@/features/confie/routes";

const AVAILABLE_SECTIONS = [
  { href: confieRoutes.agence, label: "Mes accès" },
  { href: confieRoutes.gestionDirecte, label: "Mes biens en gestion directe" },
] as const;

export function RouteUnavailable({ title }: { title: string }) {
  return (
    <>
      <header className="flex flex-col gap-2">
        <Breadcrumb items={[{ label: "Accueil", href: confieRoutes.home }, { label: title }]} Link={Link} />
        <h1 className="text-page-title">{title}</h1>
      </header>
      <Alert tone="info" title="Bientôt disponible">
        {title} n’est pas encore relié au serveur. Aucune donnée d’exemple n’est affichée à la place.
      </Alert>
      <nav aria-label="Sections disponibles" className="flex flex-wrap gap-2">
        <Button asChild variant="secondary">
          <Link href={confieRoutes.home}>Retour à l’accueil</Link>
        </Button>
        {AVAILABLE_SECTIONS.map((section) => (
          <Button key={section.href} asChild variant="secondary">
            <Link href={section.href}>{section.label}</Link>
          </Button>
        ))}
      </nav>
    </>
  );
}
