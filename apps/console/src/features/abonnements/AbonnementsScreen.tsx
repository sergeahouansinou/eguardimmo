'use client';

import { csvDocument } from '@eguardimmo/shell';
import { Badge, Button, Icon, ProgressBar, StatCard } from '@eguardimmo/ui';
import { Download, Plus } from 'lucide-react';
import Link from 'next/link';
import { useSubscriptions } from '@/console/hooks/queries';
import type { PlanRow, SubscriptionsOverview } from '@/console/schemas';
import { downloadTextFile } from '@/lib/download';
import { formatDate, formatEuros, formatInteger } from '@/lib/format';
import { DataTable } from '@/ui/DataTable';
import type { Column } from '@/ui/DataTable';
import { PageHeader } from '@/ui/PageHeader';
import { QueryState } from '@/ui/QueryState';
import { EmptyLine, ListRow, Section } from '@/ui/Section';
import { useNotify } from '@/ui/notify';

function PlanPrice({ plan }: { plan: PlanRow }) {
  return <span className="tabular-nums">{`${formatEuros(plan.monthlyMinor)} / mois · ${formatEuros(plan.yearlyMinor)} / an`}</span>;
}

export function AbonnementsScreen() {
  const query = useSubscriptions();
  return (
    <QueryState query={query} label="Les abonnements">
      {(data) => <Content data={data} />}
    </QueryState>
  );
}

function Content({ data }: { data: SubscriptionsOverview }) {
  const notify = useNotify();
  const columns: Column<PlanRow>[] = [
    {
      id: 'plan',
      header: 'Plan',
      primary: true,
      cell: (row) => (
        <span className="flex flex-col">
          <span className="font-medium">{row.name}</span>
          <span className="text-caption font-normal text-fg-subtle">{row.tagline}</span>
        </span>
      ),
    },
    { id: 'price', header: 'Prix HT', cell: (row) => <PlanPrice plan={row} /> },
    { id: 'orgs', header: 'Organisations', align: 'right', cell: (row) => <span className="tabular-nums">{formatInteger(row.organisations)}</span> },
    { id: 'trials', header: 'Dont en essai', align: 'right', cell: (row) => <span className="tabular-nums">{formatInteger(row.trials)}</span> },
    { id: 'mrr', header: 'Revenu mensuel', align: 'right', cell: (row) => <span className="tabular-nums">{formatEuros(row.mrrMinor)}</span> },
    {
      id: 'edit',
      header: 'Modifier',
      cell: (row) => (
        <Button variant="link" asChild>
          <Link href={`/abonnements/plans/${row.id}`} aria-label={`Modifier le plan ${row.name}`}>
            Modifier
          </Link>
        </Button>
      ),
    },
  ];
  const revenue = data.plans.filter((plan) => plan.mrrMinor > 0).sort((left, right) => right.mrrMinor - left.mrrMinor);
  const maxRevenue = revenue[0]?.mrrMinor ?? 1;

  const exportCsv = () => {
    downloadTextFile(
      'abonnements.csv',
      csvDocument([
        ['Plan', 'Description', 'Prix mensuel (centimes)', 'Organisations', 'Essais', 'Revenu mensuel (centimes)'],
        ...data.plans.map((plan) => [plan.name, plan.tagline, plan.monthlyMinor, plan.organisations, plan.trials, plan.mrrMinor]),
      ]),
    );
    notify.success('Export prêt', 'Les plans sont dans abonnements.csv.');
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        title="Abonnements"
        subtitle="Plans, revenus récurrents et essais en cours, en euros hors taxes."
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv}>
              <Icon icon={Download} />
              Exporter
            </Button>
            <Button asChild>
              <Link href="/abonnements/plans/nouveau">
                <Icon icon={Plus} />
                Nouveau plan
              </Link>
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenu mensuel récurrent" value={formatEuros(data.mrrMinor)}>
          <span className="text-caption text-fg-subtle">{formatInteger(data.payingCount)} abonnements payants</span>
        </StatCard>
        <StatCard label="Revenu annuel" value={formatEuros(data.arrMinor)}>
          <span className="text-caption text-fg-subtle">Revenu mensuel × 12</span>
        </StatCard>
        <StatCard label="Essais actifs" value={formatInteger(data.trialCount)}>
          <span className="text-caption text-fg-subtle">
            {data.nextTrialEnd ? `Prochaine fin le ${formatDate(data.nextTrialEnd)}` : 'Aucun essai en cours'}
          </span>
        </StatCard>
        <StatCard label="Paiements à relancer" value={formatInteger(data.failedCount)} tone={data.failedCount > 0 ? 'danger' : 'default'}>
          <span className="text-caption text-fg-subtle">À relancer</span>
        </StatCard>
      </div>
      <Section id="plans" title="Plans" aside={<span className="text-caption text-fg-subtle">{`${String(data.plans.length)} plans`}</span>}>
        <DataTable label="Plans" Link={Link} columns={columns} rows={data.plans} rowKey={(row) => row.id} />
        <dl className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-line px-2 pt-2 text-body-strong">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatInteger(data.totals.organisations)} organisations</dd>
          <dd className="tabular-nums">{formatInteger(data.totals.trials)} en essai</dd>
          <dd className="tabular-nums">{formatEuros(data.totals.mrrMinor)} par mois</dd>
        </dl>
      </Section>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Section id="repartition" title="Répartition du revenu">
          <ul className="flex flex-col gap-3 pt-1">
            {revenue.map((plan) => (
              <li key={plan.id} className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-3">
                <span className="text-body text-fg-muted">{plan.name}</span>
                <ProgressBar value={Math.round((plan.mrrMinor / maxRevenue) * 100)} label={`${plan.name} : ${formatEuros(plan.mrrMinor)}`} className="h-2" />
                <b className="text-body-strong tabular-nums">{formatEuros(plan.mrrMinor)}</b>
              </li>
            ))}
          </ul>
          <p className="pt-3 text-caption text-fg-subtle">Les essais, le plan Gratuit et le plan Propriétaire ne génèrent pas de revenu.</p>
        </Section>
        <div className="flex flex-col gap-4">
          <Section
            id="essais"
            title="Essais en cours"
            aside={
              <Link href="/organisations" className="text-caption font-medium text-action-on-subtle underline underline-offset-3">
                {`Tout voir, ${formatInteger(data.trialCount)}`}
              </Link>
            }
          >
            {data.trials.length === 0 ? (
              <EmptyLine>Aucun essai en cours.</EmptyLine>
            ) : (
              <ul>
                {data.trials.slice(0, 4).map((trial) => (
                  <ListRow
                    key={trial.organisationId}
                    title={trial.name}
                    detail={`Plan ${trial.planName} · fin le ${formatDate(trial.endsOn)}`}
                    trailing={
                      <Button variant="secondary" size="sm" asChild>
                        <Link href={`/organisations/${trial.organisationId}`} aria-label={`Ouvrir ${trial.name}`}>
                          Ouvrir
                        </Link>
                      </Button>
                    }
                  />
                ))}
              </ul>
            )}
          </Section>
          <Section
            id="echecs"
            title="Paiements en échec"
            aside={
              <Link href="/organisations" className="text-caption font-medium text-action-on-subtle underline underline-offset-3">
                {`Tout voir, ${formatInteger(data.failedCount)}`}
              </Link>
            }
          >
            {data.failures.length === 0 ? (
              <EmptyLine>Aucun paiement en échec.</EmptyLine>
            ) : (
              <ul>
                {data.failures.map((failure) => (
                  <ListRow
                    key={failure.organisationId}
                    title={
                      <Link href={`/organisations/${failure.organisationId}`} className="hover:underline">
                        {failure.name}
                      </Link>
                    }
                    detail={failure.detail}
                    trailing={<Badge tone={failure.tone}>{failure.status}</Badge>}
                  />
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
