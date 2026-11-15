'use client';

import { Alert, Badge, Button, Icon, StatCard } from '@eguardimmo/ui';
import { ArchiveRestore, CircleCheck, Info } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useSauvegardes } from '@/console/hooks/queries';
import { RESTORE_SCOPE_LABELS, RESTORE_TARGET_LABELS } from '@/console/schemas';
import type { Backup, Sauvegardes } from '@/console/schemas';
import { formatDate, formatDateTime, formatInteger, formatStorage } from '@/lib/format';
import { DataTable } from '@/ui/DataTable';
import type { Column } from '@/ui/DataTable';
import { PageHeader } from '@/ui/PageHeader';
import { QueryState } from '@/ui/QueryState';
import { EmptyLine, ListRow, Section } from '@/ui/Section';

const RECENT_COUNT = 6;

const columns: Column<Backup>[] = [
  { id: 'date', header: 'Date', primary: true, cell: (row) => formatDateTime(row.at) },
  { id: 'kind', header: 'Type', cell: (row) => (row.kind === 'quotidienne' ? 'Quotidienne' : 'Mensuelle') },
  { id: 'size', header: 'Taille', align: 'right', cell: (row) => <span className="tabular-nums">{formatStorage(row.sizeMb)}</span> },
  { id: 'duration', header: 'Durée', align: 'right', cell: (row) => <span className="tabular-nums">{`${formatInteger(row.durationMinutes)} min`}</span> },
  { id: 'state', header: 'État', cell: (row) => <Badge tone={row.success ? 'success' : 'danger'}>{row.success ? 'Réussie' : 'Échec'}</Badge> },
];

export function SauvegardesScreen() {
  const query = useSauvegardes();
  return (
    <QueryState query={query} label="Les sauvegardes">
      {(data) => <Content data={data} />}
    </QueryState>
  );
}

function Content({ data }: { data: Sauvegardes }) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? data.backups : data.backups.slice(0, RECENT_COUNT);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        title="Sauvegardes"
        subtitle="Sauvegardes chiffrées de la base et des documents, hébergées dans l’Union européenne."
        actions={
          <Button asChild>
            <Link href="/sauvegardes/restauration">
              <Icon icon={ArchiveRestore} />
              Demander une restauration
            </Link>
          </Button>
        }
      />
      <Alert tone="info">
        <span className="flex items-start gap-2">
          <Icon icon={Info} className="mt-0.5 shrink-0" />
          Toute restauration exige un motif et l’accord d’un second opérateur. Elle est consignée dans le journal d’audit.
        </span>
      </Alert>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Dernière sauvegarde" value={formatDateTime(data.latest.at)}>
          <span className="text-caption text-fg-subtle">{formatStorage(data.latest.sizeMb)} · chiffrée</span>
        </StatCard>
        <StatCard label="Conservation" value={`${formatInteger(data.retentionDays)} jours`}>
          <span className="text-caption text-fg-subtle">Quotidiennes et mensuelles</span>
        </StatCard>
        <StatCard label="Dernier test" value={formatDate(data.lastTest.on)}>
          <span className="text-caption text-fg-subtle">Réussi en {formatInteger(data.lastTest.durationMinutes)} min</span>
        </StatCard>
        <StatCard label="Espace utilisé" value={`${formatTb(data.usedGb)} To`}>
          <span className="text-caption text-fg-subtle">sur {formatTb(data.quotaGb)} To</span>
        </StatCard>
      </div>
      <Section
        id="recentes"
        title="Sauvegardes récentes"
        aside={
          <Button variant="link" onClick={() => { setShowAll((value) => !value); }}>
            {showAll ? 'Réduire' : `Tout voir, ${formatInteger(data.total)}`}
          </Button>
        }
      >
        <DataTable
          label="Sauvegardes"
          Link={Link}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          rowActions={(row) => (
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/sauvegardes/restauration?sauvegarde=${row.id}`} aria-label={`Restaurer la sauvegarde du ${formatDateTime(row.at)}`}>
                Restaurer
              </Link>
            </Button>
          )}
        />
      </Section>
      {data.requests.length > 0 ? (
        <Section id="demandes" title="Demandes de restauration">
          <ul>
            {data.requests.map((request) => (
              <ListRow
                key={request.id}
                icon={ArchiveRestore}
                tone="warning"
                title={`${request.backupName} · ${RESTORE_TARGET_LABELS[request.target]}`}
                detail={`${RESTORE_SCOPE_LABELS[request.scope]} · demandée par ${request.requestedBy} · validation : ${request.validator} · ${formatDateTime(request.requestedAt)}`}
                trailing={<Badge tone="warning">En attente d’accord</Badge>}
              />
            ))}
          </ul>
        </Section>
      ) : null}
      <Section id="tests" title="Tests de restauration">
        {data.tests.length === 0 ? (
          <EmptyLine>Aucun test enregistré.</EmptyLine>
        ) : (
          <ul>
            {data.tests.map((test) => (
              <ListRow
                key={test.id}
                icon={CircleCheck}
                tone={test.success ? 'success' : 'danger'}
                title={`Test du ${formatDate(test.on)}`}
                detail={test.detail}
                trailing={<Badge tone={test.success ? 'success' : 'danger'}>{test.success ? 'Réussi' : 'Échec'}</Badge>}
              />
            ))}
            <ListRow
              icon={CircleCheck}
              tone="neutral"
              title="Prochain test"
              detail={`Prévu le ${formatDate(data.nextTestOn)} · runbook ${data.runbook}`}
              trailing={<Badge tone="neutral">Planifié</Badge>}
            />
          </ul>
        )}
      </Section>
    </div>
  );
}

function formatTb(gigabytes: number): string {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(gigabytes / 1000);
}
