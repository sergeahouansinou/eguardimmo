'use client';

import { CircleAlert, DoorOpen, HandCoins, Receipt, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { Alert, Badge, Button, Icon, ProgressBar, StatCard } from '@eguardimmo/ui';
import type { LinkComponent } from '@eguardimmo/ui';
import { useBureau, useShellData } from '../data/queries';
import type { BureauData } from '../data/schemas';
import { formatDayMonth, formatLongDate, monthName } from '../format/dates';
import { formatMoney, percent, variation } from '../format/money';
import { accountRoutes } from '../navigation/routes';
import { ChartLegend, RentChart } from './RentChart';
import { TodoCard } from './TodoCard';
import { CardLink, EmptyLine, SectionCard, TimelineRow } from './parts';

const methodLabel: Record<BureauData['recentPayments'][number]['method'], string> = {
  virement: 'virement',
  prelevement: 'prélèvement',
  especes: 'espèces',
  cheque: 'chèque',
  mobile_money: 'mobile money',
  carte: 'carte',
};

const plural = (count: number, singular: string, pluralForm: string) =>
  `${String(count)} ${count > 1 ? pluralForm : singular}`;

export function bureauSummary(data: BureauData): string {
  const urgent = data.todos.filter((todo) => todo.urgent).length;
  const actions = data.todos.length === 0 ? 'aucune action à traiter' : `${plural(data.todos.length, 'action', 'actions')} à traiter`;
  const urgency = urgent > 0 ? `, dont ${plural(urgent, 'urgente', 'urgentes')}` : '';
  return `${formatLongDate(data.generatedAt)} · ${actions}${urgency}.`;
}

export function BureauPage({ Link }: { Link: LinkComponent }) {
  const bureau = useBureau();
  const shell = useShellData();
  const firstName = shell.data?.user.firstName;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-page-title">{firstName ? `Bonjour ${firstName}` : 'Bonjour'}</h1>
          <p className="mt-0.5 text-body text-fg-muted">{bureau.data ? bureauSummary(bureau.data) : ' '}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" asChild>
            <Link href={accountRoutes.encaisser}>
              <Icon icon={HandCoins} />
              Encaisser un loyer
            </Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href={accountRoutes.depense}>
              <Icon icon={Receipt} />
              Nouvelle dépense
            </Link>
          </Button>
        </div>
      </div>
      {bureau.isError ? (
        <Alert tone="danger" title="Le bureau n’a pas pu être chargé">
          Vérifiez votre connexion puis rechargez la page.
        </Alert>
      ) : null}
      {bureau.isPending ? <BureauSkeleton /> : null}
      {bureau.data ? <BureauContent data={bureau.data} Link={Link} /> : null}
    </>
  );
}

function BureauContent({ data, Link }: { data: BureauData; Link: LinkComponent }) {
  const money = (value: number, signed = false) => formatMoney(value, data.currency, { signed });
  const month = monthName(data.generatedAt);
  const previousMonth = data.rentHistory.at(-2)?.month;
  const collectedRate = percent(data.collection.collected, data.collection.called);
  const occupancyRate = percent(data.occupancy.rented, data.occupancy.total);
  const vacant = data.occupancy.total - data.occupancy.rented;
  const trend = variation(data.cashflow.net, data.cashflow.previousNet);
  const previousName = previousMonth
    ? new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' }).format(new Date(`${previousMonth}-15T12:00:00Z`))
    : null;

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={`Encaissé en ${month}`} icon={Wallet} value={money(data.collection.collected)}>
          <ProgressBar value={collectedRate} label={`${String(collectedRate)} %`} className="mt-1 mb-0.5" />
          <span className="text-caption text-fg-subtle">
            sur {money(data.collection.called)} appelés · {collectedRate} %
          </span>
        </StatCard>
        <StatCard label="Impayés" icon={CircleAlert} tone={data.arrears.amount > 0 ? 'danger' : 'default'} value={money(data.arrears.amount)}>
          <span className="text-caption text-fg-subtle">
            {plural(data.arrears.tenants, 'locataire', 'locataires')} ·{' '}
            {data.arrears.beyond30Days === 0 ? 'aucun au-delà de 30 jours' : `${String(data.arrears.beyond30Days)} au-delà de 30 jours`}
          </span>
        </StatCard>
        <StatCard label="Taux d'occupation" icon={DoorOpen} value={`${String(occupancyRate)} %`}>
          <ProgressBar value={occupancyRate} label={`${String(occupancyRate)} %`} className="mt-1 mb-0.5" />
          <span className="text-caption text-fg-subtle">
            {data.occupancy.rented} lots loués sur {data.occupancy.total} · {plural(vacant, 'vacant', 'vacants')}
          </span>
        </StatCard>
        <StatCard label={`Cash-flow net, ${month}`} icon={TrendingUp} value={money(data.cashflow.net, true)}>
          {trend !== null && previousName ? (
            <Badge tone={trend >= 0 ? 'success' : 'danger'} className="my-0.5 self-start">
              <Icon icon={trend >= 0 ? TrendingUp : TrendingDown} size={14} />
              {trend > 0 ? '+' : ''}
              {trend} % vs {previousName}
            </Badge>
          ) : null}
          <span className="text-caption text-fg-subtle">Revenus moins dépenses du mois</span>
        </StatCard>
      </div>

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <TodoCard todos={data.todos} Link={Link} />
        <div className="flex min-w-0 flex-col gap-3">
          <SectionCard id="bureau-aujourdhui" title="Aujourd'hui" aside={<CardLink Link={Link} href={accountRoutes.agenda}>Agenda</CardLink>}>
            {data.today.length === 0 ? (
              <EmptyLine>Aucun rendez-vous aujourd’hui.</EmptyLine>
            ) : (
              <ul>
                {data.today.map((event) => (
                  <TimelineRow key={event.id} lead={event.time} title={event.title} detail={event.detail} />
                ))}
              </ul>
            )}
          </SectionCard>
          <SectionCard id="bureau-echeances" title="Échéances" aside={<span className="text-caption text-fg-subtle">30 jours</span>}>
            {data.deadlines.length === 0 ? (
              <EmptyLine>Aucune échéance dans les 30 jours.</EmptyLine>
            ) : (
              <ul>
                {data.deadlines.map((deadline) => (
                  <TimelineRow key={deadline.id} lead={formatDayMonth(deadline.date)} title={deadline.title} detail={deadline.detail} />
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard
          id="bureau-loyers"
          title={`Loyers, ${String(data.rentHistory.length)} derniers mois`}
          aside={
            <div className="flex flex-wrap items-center gap-4">
              <ChartLegend />
              <CardLink Link={Link} href={accountRoutes.analytique}>Ouvrir l&apos;analytique</CardLink>
            </div>
          }
        >
          <RentChart history={data.rentHistory} currency={data.currency} />
        </SectionCard>
        <SectionCard id="bureau-encaissements" title="Derniers encaissements" aside={<CardLink Link={Link} href="/finances">Tout voir</CardLink>}>
          {data.recentPayments.length === 0 ? (
            <EmptyLine>Aucun encaissement récent.</EmptyLine>
          ) : (
            <ul>
              {data.recentPayments.map((payment) => (
                <TimelineRow
                  key={payment.id}
                  lead={formatDayMonth(payment.date)}
                  title={payment.tenant}
                  detail={`${payment.unit} · ${payment.partial ? 'partiel' : methodLabel[payment.method]}`}
                  trailing={<span className="text-body font-semibold whitespace-nowrap text-fg tabular-nums">{money(payment.amount)}</span>}
                />
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}

function BureauSkeleton() {
  return (
    <div aria-busy="true" aria-label="Chargement du bureau" className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="h-[104px] animate-pulse rounded-lg border border-line bg-surface" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="h-[380px] animate-pulse rounded-lg border border-line bg-surface" />
        <div className="h-[380px] animate-pulse rounded-lg border border-line bg-surface" />
      </div>
    </div>
  );
}
