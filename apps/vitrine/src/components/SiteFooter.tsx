import Link from "next/link";
import { Container } from "./Container";
import { siteEnv } from "@/lib/env";
import { spaceLinks } from "@/lib/links";
import { LEGAL_ROUTES, NAV_ROUTES } from "@/lib/routes";

const LINK_CLASS =
  "inline-flex min-h-11 min-w-11 items-center rounded-sm text-nav-fg underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <h2 className="text-body-strong text-fg-inverse">{title}</h2>
      <ul className="flex flex-col">{children}</ul>
    </div>
  );
}

export function SiteFooter() {
  const contactEmail = siteEnv().NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <footer className="on-dark bg-nav text-nav-fg">
      <Container className="grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-value font-bold text-fg-inverse">eGuardImmo</p>
          <p className="max-w-[32ch] text-body">La gestion locative d’une agence, dans un espace pour chaque acteur.</p>
          {contactEmail ? (
            <a href={`mailto:${contactEmail}`} className={`${LINK_CLASS} [overflow-wrap:anywhere]`}>
              {contactEmail}
            </a>
          ) : null}
        </div>
        <Column title="Site">
          {NAV_ROUTES.map((route) => (
            <li key={route.href}>
              <Link href={route.href} className={LINK_CLASS}>
                {route.label}
              </Link>
            </li>
          ))}
        </Column>
        <Column title="Espaces">
          {spaceLinks().map((space) => (
            <li key={space.key}>
              <a href={space.href} className={LINK_CLASS}>
                {space.label}
              </a>
            </li>
          ))}
        </Column>
        <Column title="Informations">
          {LEGAL_ROUTES.map((route) => (
            <li key={route.href}>
              <Link href={route.href} className={LINK_CLASS}>
                {route.label}
              </Link>
            </li>
          ))}
        </Column>
      </Container>
      <Container className="border-t border-nav-muted/40 py-4">
        <p className="text-caption text-nav-muted">© 2026 eGuardImmo</p>
      </Container>
    </footer>
  );
}
