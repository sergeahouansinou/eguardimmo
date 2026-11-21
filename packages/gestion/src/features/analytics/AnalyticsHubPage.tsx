'use client';

import { Card, Icon } from '@eguardimmo/ui';
import { BarChart3, Building2, CalendarRange, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader, useGestionNavigation } from '../locataires/kit';
import { links } from '../locataires/kit/links';
import { useOrgInfoSource } from '../orgapi/source';
import { analyticsPaths } from './paths';

interface Entry {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  landlordOnly: boolean;
}

const ENTRIES: readonly Entry[] = [
  { href: analyticsPaths.revenue, title: 'Revenus et dépenses', description: 'Recettes, dépenses et financement par mois et par lot.', icon: BarChart3, landlordOnly: false },
  { href: analyticsPaths.occupancy, title: 'Occupation', description: 'État de chaque lot, mois par mois.', icon: Building2, landlordOnly: false },
  { href: analyticsPaths.profitability, title: 'Rentabilité par bien', description: 'Rendements bruts et nets, à partir du coût de revient.', icon: TrendingUp, landlordOnly: true },
  { href: analyticsPaths.forecast, title: 'Prévisionnel de trésorerie', description: 'Projection sur 12 mois avec vos hypothèses.', icon: CalendarRange, landlordOnly: true },
];

export function AnalyticsHubPage() {
  const { Link } = useGestionNavigation();
  const { kind } = useOrgInfoSource();
  return (
    <>
      <PageHeader crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Analytique' }]} title="Analytique" subtitle="Des chiffres calculés par le serveur à partir de votre grand livre et de vos baux." />
      <ul className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
        {ENTRIES.filter((entry) => !entry.landlordOnly || kind !== 'agency').map((entry) => (
          <li key={entry.href}>
            <Card className="h-full gap-1">
              <Link href={entry.href} className="inline-flex min-h-6 items-center gap-2 text-block-title text-action-on-subtle underline underline-offset-2">
                <Icon icon={entry.icon} />
                {entry.title}
              </Link>
              <p className="text-body text-fg-muted">{entry.description}</p>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
