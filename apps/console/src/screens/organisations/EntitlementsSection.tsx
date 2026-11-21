'use client';

import { Alert, Badge, Button } from '@eguardimmo/ui';
import Link from 'next/link';
import { useState } from 'react';
import { formatDate } from '@/lib/format';
import { describeProblem } from '@/platform/errors';
import { hasRole } from '@/platform/roles';
import type { EntitlementOverride, OrganisationEntitlements } from '@/platform/plans/subscriptions';
import { DataTable } from '@/ui/DataTable';
import type { Column } from '@/ui/DataTable';
import { LoadingBlock, ProblemAlert } from '@/ui/PlatformState';
import { EmptyLine, Section } from '@/ui/Section';
import { useEntitlements, usePendingApprovals, useRoles } from './hooks';
import { GrantOverrideDialog, RevokeOverrideDialog } from './OverrideDialogs';
import { GROUP_LABELS, OVERRIDE_REASON_LABELS, SOURCE_LABELS, SUBSCRIPTION_LABELS } from './labels';

type Entitlement = OrganisationEntitlements['entitlements'][number];

const entitlementColumns: Column<Entitlement>[] = [
  { id: 'feature', header: 'Fonction', primary: true, cell: (row) => row.label },
  { id: 'group', header: 'Groupe', cell: (row) => GROUP_LABELS[row.group] ?? row.group },
  { id: 'kind', header: 'Type', cell: (row) => (row.kind === 'quota' ? 'Quota' : 'Fonction') },
  { id: 'enabled', header: 'État', cell: (row) => <Badge tone={row.enabled ? 'success' : 'neutral'}>{row.enabled ? 'Incluse' : 'Non incluse'}</Badge> },
  { id: 'limit', header: 'Limite', align: 'right', cell: (row) => (row.kind === 'quota' ? (row.limit === null ? 'Illimité' : <span className="tabular-nums">{String(row.limit)}</span>) : '—') },
  { id: 'source', header: 'Source', cell: (row) => (row.source === null ? '—' : (SOURCE_LABELS[row.source] ?? row.source)) },
];

export function EntitlementsSection({ organisationId }: { organisationId: string }) {
  const query = useEntitlements(organisationId);
  return (
    <Section id="droits" title="Droits effectifs">
      {query.isError ? (
        describeProblem(query.error).code === 'subscription_not_found' ? (
          <EmptyLine>Aucun abonnement : cette organisation n’a pas encore de droits à afficher.</EmptyLine>
        ) : (
          <ProblemAlert error={query.error} label="Les droits" onRetry={query.refetch} />
        )
      ) : query.data === undefined ? (
        <LoadingBlock label="Les droits de l’organisation" />
      ) : (
        <EntitlementsContent organisationId={organisationId} view={query.data} />
      )}
    </Section>
  );
}

function EntitlementsContent({ organisationId, view }: { organisationId: string; view: OrganisationEntitlements }) {
  const roles = useRoles();
  const pending = usePendingApprovals();
  const [granting, setGranting] = useState(false);
  const [revoking, setRevoking] = useState<EntitlementOverride | null>(null);
  const canRequest = hasRole(roles, 'billing');
  const grantPending = pending.find((row) => row.action === 'subscriptions.override.grant' && row.subjectId === organisationId);
  const isRevokePending = (id: string) => pending.some((row) => row.action === 'subscriptions.override.revoke' && row.subjectId === id);
  const labelOf = (feature: string) => view.entitlements.find((e) => e.feature === feature)?.label ?? feature;
  const { subscription } = view;

  const overrideColumns: Column<EntitlementOverride>[] = [
    { id: 'feature', header: 'Fonction', primary: true, cell: (row) => labelOf(row.feature) },
    { id: 'effect', header: 'Effet', cell: (row) => (row.enabled ? 'Activée' : 'Désactivée') },
    { id: 'limit', header: 'Limite', align: 'right', cell: (row) => (row.limit === null ? '—' : <span className="tabular-nums">{String(row.limit)}</span>) },
    { id: 'period', header: 'Période', cell: (row) => `${formatDate(row.startsAt)} au ${formatDate(row.endsAt)}` },
    { id: 'reason', header: 'Motif', cell: (row) => OVERRIDE_REASON_LABELS[row.reasonCode] ?? row.reasonCode },
    {
      id: 'state',
      header: 'État',
      cell: (row) =>
        row.revokedAt !== null ? (
          <Badge tone="neutral">Retirée le {formatDate(row.revokedAt)}</Badge>
        ) : isRevokePending(row.id) ? (
          <Badge tone="warning">Retrait en attente d’un second opérateur</Badge>
        ) : (
          <Badge tone="success">En vigueur</Badge>
        ),
    },
    {
      id: 'actions',
      header: 'Action',
      cell: (row) =>
        canRequest && row.revokedAt === null && !isRevokePending(row.id) ? (
          <Button size="sm" variant="secondary" onClick={() => { setRevoking(row); }}>
            Retirer
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-body text-fg-muted">
        Plan <b className="text-fg">{subscription.plan}</b> (version {String(subscription.planVersion)}) · {SUBSCRIPTION_LABELS[subscription.status] ?? subscription.status}
        {subscription.trialEndsAt === null ? '' : ` · fin d’essai le ${formatDate(subscription.trialEndsAt)}`}
        {subscription.currency === null ? '' : ` · ${subscription.currency}`}
      </p>
      <DataTable label="Droits de l’organisation" Link={Link} columns={entitlementColumns} rows={view.entitlements} rowKey={(row) => row.feature} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-body-strong">Dérogations</h3>
        {canRequest && grantPending === undefined ? (
          <Button size="sm" onClick={() => { setGranting(true); }}>
            Demander une dérogation
          </Button>
        ) : null}
      </div>
      {grantPending ? (
        <Alert tone="info" title="Dérogation en attente d’un second opérateur">
          Une demande est en cours de validation. <Link href="/approbations" className="underline underline-offset-3">Voir les approbations</Link>
        </Alert>
      ) : null}
      {view.overrides.length === 0 ? (
        <EmptyLine>Aucune dérogation sur cet abonnement.</EmptyLine>
      ) : (
        <DataTable label="Dérogations de l’organisation" Link={Link} columns={overrideColumns} rows={view.overrides} rowKey={(row) => row.id} />
      )}
      <GrantOverrideDialog open={granting} onOpenChange={setGranting} organisationId={organisationId} entitlements={view.entitlements} />
      {revoking ? (
        <RevokeOverrideDialog
          open
          onOpenChange={(open) => {
            if (!open) setRevoking(null);
          }}
          overrideId={revoking.id}
          featureLabel={labelOf(revoking.feature)}
        />
      ) : null}
    </div>
  );
}
