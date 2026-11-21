'use client';

import { Badge, EmptyState } from '@eguardimmo/ui';
import { Layers } from 'lucide-react';
import Link from 'next/link';
import type { PlatformQuery } from '@/platform/context';
import type { Plan, PlanVersion } from '@/platform/plans/plans';
import { DataTable } from '@/ui/DataTable';
import type { Column } from '@/ui/DataTable';
import { PlatformState } from '@/ui/PlatformState';
import { formatMinor } from './money';

export interface PlanLine {
  plan: Plan;
  published: PlanVersion | null;
  draft: PlanVersion | null;
}

export function planLine(plan: Plan): PlanLine {
  const byVersion = [...plan.versions].sort((a, b) => b.version - a.version);
  return {
    plan,
    published: byVersion.find((version) => version.status === 'published') ?? null,
    draft: byVersion.find((version) => version.status === 'draft') ?? null,
  };
}

const columns: Column<PlanLine>[] = [
  {
    id: 'plan',
    header: 'Plan',
    primary: true,
    cell: ({ plan }) => (
      <Link href={`/abonnements/plans/${encodeURIComponent(plan.code)}`} className="flex flex-col hover:underline">
        <span className="font-medium">{plan.name}</span>
        <span className="font-mono text-caption font-normal text-fg-subtle">{plan.code}</span>
      </Link>
    ),
  },
  {
    id: 'version',
    header: 'Version publiée',
    cell: ({ published }) => (published ? <span className="tabular-nums">v{published.version}</span> : <span className="text-fg-subtle">Aucune</span>),
  },
  {
    id: 'prices',
    header: 'Prix',
    cell: ({ published }) =>
      published && published.prices.length > 0 ? (
        <span className="flex flex-col tabular-nums">
          {published.prices.map((price) => (
            <span key={price.currency}>{`${formatMinor(price.monthlyAmount, price.currency)} / mois · ${formatMinor(price.yearlyAmount, price.currency)} / an`}</span>
          ))}
        </span>
      ) : (
        <span className="text-fg-subtle">—</span>
      ),
  },
  { id: 'trial', header: 'Essai', cell: ({ published }) => (published ? `${String(published.trialDays)} jours` : '—') },
  { id: 'signup', header: 'Inscription publique', cell: ({ published }) => (published ? (published.publicSignup ? 'Oui' : 'Non') : '—') },
  {
    id: 'rights',
    header: 'Droits activés',
    cell: ({ published }) => (published ? <span className="tabular-nums">{`${String(published.entitlements.filter((e) => e.enabled).length)} sur ${String(published.entitlements.length)}`}</span> : '—'),
  },
  {
    id: 'draft',
    header: 'Brouillon',
    cell: ({ draft }) => (draft ? <Badge tone="warning">{`Brouillon v${String(draft.version)}`}</Badge> : <span className="text-fg-subtle">—</span>),
  },
];

export function PlansPanel({ query }: { query: PlatformQuery<Plan[]> }) {
  return (
    <PlatformState query={query} label="Les plans">
      {(plans) =>
        plans.length === 0 ? (
          <EmptyState icon={Layers} title="Aucun plan" description="Le catalogue de plans est vide : la grille est chargée par le serveur." />
        ) : (
          <DataTable
            label="Plans"
            columns={columns}
            rows={plans.map(planLine)}
            rowKey={(row) => row.plan.id}
            rowLink={(row) => ({ href: `/abonnements/plans/${encodeURIComponent(row.plan.code)}`, label: `Ouvrir le plan ${row.plan.name}` })}
            Link={Link}
          />
        )
      }
    </PlatformState>
  );
}
