'use client';

import { Alert, Badge, Button } from '@eguardimmo/ui';
import Link from 'next/link';
import { usePlans } from '@/screens/abonnements/hooks';
import { GROUP_LABELS } from '@/screens/organisations/labels';
import { DataTable } from '@/ui/DataTable';
import type { Column } from '@/ui/DataTable';
import { PageHeader } from '@/ui/PageHeader';
import { PlatformState } from '@/ui/PlatformState';
import { KeyValueList, Section } from '@/ui/Section';
import { buildRegistry, limitText } from './registry';
import type { FeaturePlan, FeatureRow } from './registry';

function planColumns(kind: FeatureRow['kind']): Column<FeaturePlan>[] {
  const base: Column<FeaturePlan>[] = [
    {
      id: 'plan',
      header: 'Plan',
      primary: true,
      cell: (plan) => (
        <Link href={`/abonnements/plans/${encodeURIComponent(plan.code)}`} className="inline-flex min-h-6 items-center hover:underline">
          {plan.name}
        </Link>
      ),
    },
    { id: 'version', header: 'Version publiée', cell: (plan) => <span className="tabular-nums">{`v${String(plan.version)}`}</span> },
    { id: 'state', header: 'État', cell: (plan) => <Badge tone={plan.enabled ? 'success' : 'neutral'}>{plan.enabled ? 'Incluse' : 'Non incluse'}</Badge> },
  ];
  return kind === 'quota' ? [...base, { id: 'limit', header: 'Limite', align: 'right', cell: (plan) => <span className="tabular-nums">{limitText(plan)}</span> }] : base;
}

export function ModuleScreen({ feature }: { feature: string }) {
  const plans = usePlans();
  return (
    <PlatformState query={plans} label="Le module">
      {(list) => {
        const row = buildRegistry(list).find((candidate) => candidate.feature === feature);
        return row === undefined ? <NotFound /> : <Content row={row} />;
      }}
    </PlatformState>
  );
}

function NotFound() {
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <h1 className="text-page-title">Module introuvable</h1>
      <Alert tone="warning" title="Introuvable">
        Cette fonction n’existe pas dans les versions publiées des plans.
      </Alert>
      <div>
        <Button variant="secondary" asChild>
          <Link href="/modules">Retour aux modules</Link>
        </Button>
      </div>
    </div>
  );
}

function Content({ row }: { row: FeatureRow }) {
  const everywhere = row.plans.every((plan) => plan.enabled);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        breadcrumb={[{ label: 'Modules', href: '/modules' }, { label: row.label }]}
        title={row.label}
        badges={<Badge tone="neutral">{GROUP_LABELS[row.group] ?? row.group}</Badge>}
        subtitle="Les droits d’une organisation se lisent dans sa fiche ; un geste commercial passe par une dérogation validée par un second opérateur."
      />
      <Section id="module" title="Fonction">
        <KeyValueList
          items={[
            { label: 'Code', value: <span className="font-mono">{row.feature}</span> },
            { label: 'Groupe', value: GROUP_LABELS[row.group] ?? row.group },
            { label: 'Type', value: row.kind === 'quota' ? 'Quota chiffré' : 'Fonction activable' },
            { label: 'Couverture', value: everywhere ? 'Incluse dans tous les plans publiés' : 'Réservée à certains plans' },
          ]}
        />
      </Section>
      <Section id="plans" title="Plans publiés">
        <DataTable label="Plans publiés du module" columns={planColumns(row.kind)} rows={row.plans} rowKey={(plan) => plan.code} Link={Link} />
      </Section>
    </div>
  );
}
