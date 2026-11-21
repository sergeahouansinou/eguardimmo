'use client';

import { Alert, Button, StatCard } from '@eguardimmo/ui';
import { Building2, ClipboardCheck, CreditCard, LifeBuoy, ShieldCheck, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatDateTime, formatInteger } from '@/lib/format';
import { usePlatformQuery } from '@/platform/context';
import { describeProblem } from '@/platform/errors';
import type { Overview } from '@/platform/overview/overview';
import { PageHeader } from '@/ui/PageHeader';
import { LoadingBlock, ProblemAlert } from '@/ui/PlatformState';
import { subscriptionStatusLabel } from './overviewLabels';

function Group({ id, title, href, linkLabel, icon, children }: { id: string; title: string; href: string; linkLabel: string; icon: LucideIcon; children: ReactNode }) {
  const Icon = icon;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="flex items-center gap-2 text-block-title">
          <Icon aria-hidden="true" size={16} />
          {title}
        </h2>
        <Link href={href} className="inline-flex min-h-6 items-center text-body text-action underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
          {linkLabel}
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

const n = (value: number) => formatInteger(value);

function Sections({ data }: { data: Overview }) {
  const { organizations, accounts, subscriptions, support, privacy } = data;
  const empty = [organizations, accounts, subscriptions, support, privacy].every((section) => section === null);
  return (
    <>
      {empty ? <Alert tone="info">Aucune section n’est servie pour votre rôle d’opérateur.</Alert> : null}
      {organizations ? (
        <Group id="accueil-organisations" title="Organisations" href="/organisations" linkLabel="Voir les organisations" icon={Building2}>
          <StatCard label="Organisations au total" value={n(organizations.total)} />
          <StatCard label="Agences" value={n(organizations.agencies)} />
          <StatCard label="Particuliers" value={n(organizations.individuals)} />
          <StatCard label="Suspendues" value={n(organizations.suspended)} tone={organizations.suspended > 0 ? 'danger' : 'default'} />
          <StatCard label="Créées sur 30 jours" value={n(organizations.created30d)} />
        </Group>
      ) : null}
      {accounts ? (
        <Group id="accueil-comptes" title="Comptes" href="/comptes" linkLabel="Chercher un compte" icon={Users}>
          <StatCard label="Comptes actifs" value={n(accounts.total)} />
          <StatCard label="Suspendus" value={n(accounts.suspended)} />
          <StatCard label="Suspensions à revoir" value={n(accounts.suspensionToReview)} tone={accounts.suspensionToReview > 0 ? 'danger' : 'default'} />
          <StatCard label="Créés sur 30 jours" value={n(accounts.created30d)} />
        </Group>
      ) : null}
      {subscriptions ? (
        <Group id="accueil-abonnements" title="Abonnements" href="/abonnements" linkLabel="Voir les abonnements" icon={CreditCard}>
          <StatCard label="Essais finissant sous 7 jours" value={n(subscriptions.trialsEnding7d)} />
          {subscriptions.byStatus.map((entry) => (
            <StatCard key={`statut-${entry.key}`} label={`Statut : ${subscriptionStatusLabel(entry.key)}`} value={n(entry.total)} />
          ))}
          {subscriptions.byPlan.map((entry) => (
            <StatCard key={`plan-${entry.key}`} label={`Plan : ${entry.key}`} value={n(entry.total)} />
          ))}
        </Group>
      ) : null}
      {support ? (
        <Group id="accueil-support" title="Support" href="/support" linkLabel="Ouvrir le support" icon={LifeBuoy}>
          <StatCard label="Tickets ouverts" value={n(support.openTotal)} />
          <StatCard label="En attente du support" value={n(support.awaitingSupport)} />
          <StatCard label="En attente du demandeur" value={n(support.awaitingRequester)} />
          <StatCard label="Non assignées" value={n(support.unassigned)} tone={support.unassigned > 0 ? 'danger' : 'default'} />
        </Group>
      ) : null}
      {privacy ? (
        <Group id="accueil-rgpd" title="Conformité RGPD" href="/rgpd" linkLabel="Voir les demandes" icon={ShieldCheck}>
          <StatCard label="Demandes RGPD ouvertes" value={n(privacy.openTotal)} />
          <StatCard label="En retard" value={n(privacy.overdue)} tone={privacy.overdue > 0 ? 'danger' : 'default'} />
          <StatCard label="Échéance sous 7 jours" value={n(privacy.dueWithin7d)} />
        </Group>
      ) : null}
    </>
  );
}

function NoHome() {
  return (
    <Alert tone="info" title="Votre rôle n’a pas d’accueil">
      <span className="flex flex-col gap-2">
        Cette page rassemble des chiffres de gestion que votre rôle d’opérateur ne lit pas. Les écrans d’exploitation restent accessibles.
        <span className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/sante">Santé du système</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/sauvegardes">Sauvegardes</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/parametres">Paramètres</Link>
          </Button>
        </span>
      </span>
    </Alert>
  );
}

export function AccueilScreen() {
  const query = usePlatformQuery(['overview'], (api) => api.overview());
  const forbidden = query.isError && describeProblem(query.error).kind === 'forbidden';
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        title="Vue d’ensemble"
        subtitle={query.data ? `Chiffres du ${formatDateTime(query.data.generatedAt)}, en nombres de comptes uniquement.` : 'Chiffres de la plateforme, en nombres de comptes uniquement.'}
        actions={
          <Button asChild variant="secondary">
            <Link href="/approbations">
              <ClipboardCheck aria-hidden="true" size={14} />
              Approbations
            </Link>
          </Button>
        }
      />
      {forbidden ? <NoHome /> : null}
      {query.isError && !forbidden ? <ProblemAlert error={query.error} label="La vue d’ensemble" onRetry={query.refetch} /> : null}
      {!query.isError && (query.isPending || query.data === undefined) ? <LoadingBlock label="La vue d’ensemble" /> : null}
      {query.data ? <Sections data={query.data} /> : null}
    </div>
  );
}
