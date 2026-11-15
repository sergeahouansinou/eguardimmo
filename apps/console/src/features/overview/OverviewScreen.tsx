'use client';

import { Alert, Badge, Button, Icon, StatCard } from '@eguardimmo/ui';
import { CircleAlert, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ExportAuditButton } from '@/features/audit/ExportAuditButton';
import { OpenIncidentDialog } from '@/features/sante/OpenIncidentDialog';
import { useOverview } from '@/console/hooks/queries';
import { AUDIT_TYPE_LABELS, AUDIT_TYPE_TONES, RGPD_TYPE_LABELS } from '@/console/schemas';
import type { Overview } from '@/console/schemas';
import { formatDate, formatDateTime, formatInteger, formatPercentBp, formatTime } from '@/lib/format';
import { PageHeader } from '@/ui/PageHeader';
import { QueryState } from '@/ui/QueryState';
import { EmptyLine, ListRow, Section } from '@/ui/Section';

export function OverviewScreen() {
  const query = useOverview();
  return (
    <QueryState query={query} label="La vue d’ensemble">
      {(data) => <OverviewContent data={data} />}
    </QueryState>
  );
}

function OverviewContent({ data }: { data: Overview }) {
  const [incidentOpen, setIncidentOpen] = useState(false);
  const { organisations, accounts, incident } = data;
  const orgTypes = [
    { label: 'Bailleurs', value: organisations.bailleurs },
    { label: 'Agences sous mandat', value: organisations.agences },
    { label: 'Propriétaires', value: organisations.proprietaires },
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        title="Vue d’ensemble"
        subtitle={`Plateforme eGuardImmo · API en ${String(data.moduleCount)} modules, cloisonnée par organisation · ${formatDateTime(data.generatedAt)}`}
        actions={
          <>
            <ExportAuditButton />
            <Button onClick={() => { setIncidentOpen(true); }}>
              <Icon icon={Plus} />
              Ouvrir un incident
            </Button>
          </>
        }
      />
      {incident ? (
        <Alert tone="warning" title={incident.title}>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              Incident ouvert à {formatTime(incident.openedAt)}. {incident.summary}
            </span>
            <Link href={`/sante/incidents/${incident.id}`} className="font-medium underline underline-offset-3">
              Voir l’incident
            </Link>
          </span>
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Organisations actives" value={formatInteger(organisations.actives)}>
          <span className="text-caption text-fg-subtle">
            sur {formatInteger(organisations.total)} : {formatInteger(organisations.essais)} en essai,{' '}
            {formatInteger(organisations.suspendues)} suspendues
          </span>
        </StatCard>
        <StatCard label="Comptes" value={formatInteger(accounts.total)}>
          <span className="text-caption text-fg-subtle">{formatInteger(accounts.profiles)} profils actifs</span>
        </StatCard>
        <StatCard label="Disponibilité, 30 jours" value={formatPercentBp(data.availabilityBp)}>
          <span className="text-caption text-fg-subtle">
            {formatInteger(data.modulesOperational)} modules sur {formatInteger(data.moduleCount)} opérationnels
          </span>
        </StatCard>
        <StatCard label="Demandes RGPD" value={formatInteger(data.rgpd.pending)}>
          <span className="text-caption text-fg-subtle">Délai légal d’un mois</span>
        </StatCard>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Section
          id="sante-modules"
          title="Santé des modules"
          aside={
            <Link href="/modules" className="text-caption font-medium text-action-on-subtle underline underline-offset-3">
              Tout voir, {formatInteger(data.moduleCount)}
            </Link>
          }
        >
          <ul>
            {data.modules.map((module) => (
              <ListRow
                key={module.id}
                title={
                  <Link href={`/modules/${module.id}`} className="hover:underline">
                    {module.name}
                  </Link>
                }
                detail={module.description}
                trailing={
                  <Badge tone={module.state === 'operational' ? 'success' : 'warning'}>
                    {module.state === 'operational' ? 'Opérationnel' : 'Dégradé'}
                  </Badge>
                }
              />
            ))}
          </ul>
        </Section>
        <Section id="orgs-par-type" title="Organisations par type">
          <ul>
            {orgTypes.map((item) => (
              <ListRow key={item.label} title={item.label} trailing={<b className="tabular-nums">{formatInteger(item.value)}</b>} />
            ))}
          </ul>
          <p className="pt-2 text-caption text-fg-subtle">Les locataires sont des profils d’un compte, pas des organisations.</p>
        </Section>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section
          id="rgpd-a-traiter"
          title="Demandes RGPD à traiter"
          aside={
            <Link href="/rgpd" className="text-caption font-medium text-action-on-subtle underline underline-offset-3">
              Tout voir, {formatInteger(data.rgpd.pending)}
            </Link>
          }
        >
          {data.rgpd.rows.length === 0 ? (
            <EmptyLine>Aucune demande en attente.</EmptyLine>
          ) : (
            <ul>
              {data.rgpd.rows.map((row) => (
                <ListRow
                  key={row.id}
                  icon={CircleAlert}
                  tone="warning"
                  title={`${RGPD_TYPE_LABELS[row.type]}, ${row.requester}`}
                  detail={`Reçue le ${formatDate(row.receivedOn)} · à traiter avant le ${formatDate(row.dueOn)}`}
                  trailing={
                    <Button variant="secondary" size="sm" asChild>
                      <Link href={`/rgpd/${row.id}`} aria-label={`Traiter : ${RGPD_TYPE_LABELS[row.type]}, ${row.requester}`}>
                        Traiter
                      </Link>
                    </Button>
                  }
                />
              ))}
            </ul>
          )}
        </Section>
        <Section
          id="audit-recent"
          title="Journal d’audit"
          aside={
            <Link href="/audit" className="text-caption font-medium text-action-on-subtle underline underline-offset-3">
              Tout voir, {formatInteger(data.audit.total)}
            </Link>
          }
        >
          <ul>
            {data.audit.rows.map((row) => (
              <ListRow
                key={row.id}
                title={
                  <Link href={`/audit/${row.id}`} className="hover:underline">
                    {row.title}
                  </Link>
                }
                detail={`${formatDateTime(row.at)} · ${row.context}`}
                trailing={<Badge tone={AUDIT_TYPE_TONES[row.type]}>{AUDIT_TYPE_LABELS[row.type]}</Badge>}
              />
            ))}
          </ul>
        </Section>
      </div>
      <OpenIncidentDialog open={incidentOpen} onOpenChange={setIncidentOpen} />
    </div>
  );
}
