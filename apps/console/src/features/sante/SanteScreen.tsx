'use client';

import { Alert, Badge, Button, Icon, StatCard } from '@eguardimmo/ui';
import { Plus, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useSante } from '@/console/hooks/queries';
import type { QueueRow, Sante, ServiceRow } from '@/console/schemas';
import { formatDate, formatDateTime, formatDecimal, formatInteger, formatPercentBp, formatTime } from '@/lib/format';
import { DataTable } from '@/ui/DataTable';
import type { Column } from '@/ui/DataTable';
import { PageHeader } from '@/ui/PageHeader';
import { QueryState } from '@/ui/QueryState';
import { KeyValueList, Section, UsageBar } from '@/ui/Section';
import { useNotify } from '@/ui/notify';
import { LatencyChart } from './LatencyChart';
import { OpenIncidentDialog } from './OpenIncidentDialog';

function formatLatency(ms: number): string {
  if (ms < 10_000) return `${formatInteger(ms)} ms`;
  const seconds = Math.round(ms / 1000);
  return `${formatInteger(Math.floor(seconds / 60))} min ${String(seconds % 60).padStart(2, '0')} s`;
}

function formatAge(seconds: number | null): string {
  if (seconds === null) return 'File vide';
  if (seconds < 60) return `Plus ancien : ${formatInteger(seconds)} s`;
  return `Plus ancien : ${formatInteger(Math.round(seconds / 60))} min`;
}

const serviceColumns: Column<ServiceRow>[] = [
  { id: 'service', header: 'Service', primary: true, cell: (row) => row.name },
  {
    id: 'state',
    header: 'État',
    cell: (row) => <Badge tone={row.state === 'operational' ? 'success' : 'warning'}>{row.state === 'operational' ? 'Opérationnel' : 'Dégradé'}</Badge>,
  },
  { id: 'latency', header: 'Latence p95', align: 'right', cell: (row) => <span className="tabular-nums">{formatLatency(row.latencyMs)}</span> },
  { id: 'availability', header: 'Disponibilité, 30 j', align: 'right', cell: (row) => <span className="tabular-nums">{formatPercentBp(row.availabilityBp)}</span> },
];

const queueColumns: Column<QueueRow>[] = [
  {
    id: 'queue',
    header: 'File',
    primary: true,
    cell: (row) => (
      <span className="flex flex-col">
        <span className="font-medium">{row.name}</span>
        <span className="text-caption font-normal text-fg-subtle">{formatAge(row.oldestSeconds)}</span>
      </span>
    ),
  },
  { id: 'pending', header: 'En attente', align: 'right', cell: (row) => <span className="tabular-nums">{formatInteger(row.pending)}</span> },
  { id: 'state', header: 'État', cell: (row) => <Badge tone={row.slow ? 'warning' : 'success'}>{row.slow ? 'Ralentie' : 'Normale'}</Badge> },
];

export function SanteScreen() {
  const query = useSante();
  return (
    <QueryState query={query} label="La santé du système">
      {(data) => <Content data={data} onRefresh={query.refetch} />}
    </QueryState>
  );
}

function Content({ data, onRefresh }: { data: Sante; onRefresh: () => void }) {
  const [incidentOpen, setIncidentOpen] = useState(false);
  const notify = useNotify();
  const { database, incident } = data;
  const errorRate = data.errors5xx.total === 0 ? 0 : (data.errors5xx.failed / data.errors5xx.total) * 100;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        title="Santé du système"
        subtitle={`Relevé du ${formatDate(data.measuredAt)} à ${formatTime(data.measuredAt)} · actualisé toutes les minutes`}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                onRefresh();
                notify.success('Relevé actualisé', `Mesures de ${formatTime(data.measuredAt)}.`);
              }}
            >
              <Icon icon={RefreshCw} />
              Actualiser
            </Button>
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
              Incident ouvert à {formatTime(incident.openedAt)} · {formatInteger(incident.pendingMessages)} messages en attente.
            </span>
            <Link href={`/sante/incidents/${incident.id}`} className="font-medium underline underline-offset-3">
              Voir l’incident
            </Link>
          </span>
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Disponibilité, 30 jours" value={formatPercentBp(data.availabilityBp)}>
          <span className="text-caption text-fg-subtle">
            {formatInteger(data.modulesOperational)} modules sur {formatInteger(data.modulesTotal)} opérationnels
          </span>
        </StatCard>
        <StatCard label="Latence p95 de l’API" value={`${formatInteger(data.p95Ms)} ms`}>
          <span className="text-caption text-fg-subtle">Objectif : moins de {formatInteger(data.p95TargetMs)} ms</span>
        </StatCard>
        <StatCard label="Messages en file" value={formatInteger(data.queuePending)}>
          <span className="text-caption text-fg-subtle">dont {formatInteger(data.queueEmails)} e-mails</span>
        </StatCard>
        <StatCard label="Erreurs 5xx, 24 h" value={`${formatDecimal(errorRate)} %`}>
          <span className="text-caption text-fg-subtle">
            {formatInteger(data.errors5xx.failed)} requêtes sur {formatInteger(data.errors5xx.total)}
          </span>
        </StatCard>
      </div>
      <Section id="services" title="Services" aside={<span className="text-caption text-fg-subtle">{`${String(data.services.length)} services`}</span>}>
        <DataTable label="Services" Link={Link} columns={serviceColumns} rows={data.services} rowKey={(row) => row.id} />
      </Section>
      <Section id="files" title="Files d’attente" aside={<span className="text-caption text-fg-subtle">{`${formatInteger(data.queuePending)} en attente`}</span>}>
        <DataTable label="Files d’attente" Link={Link} columns={queueColumns} rows={data.queues} rowKey={(row) => row.id} />
      </Section>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section id="base" title="Base de données">
          <div className="flex flex-col gap-3 pt-1">
            <UsageBar
              label="Connexions"
              value={database.connections.used}
              max={database.connections.max}
              text={`${formatInteger(database.connections.used)} sur ${formatInteger(database.connections.max)}`}
            />
            <UsageBar
              label="Disque"
              value={database.diskGbTenths.used}
              max={database.diskGbTenths.max}
              text={`${formatDecimal(database.diskGbTenths.used / 10)} sur ${formatInteger(database.diskGbTenths.max / 10)} Go`}
            />
            <UsageBar label="Mémoire" value={database.memoryPercent} max={100} text={`${formatInteger(database.memoryPercent)} %`} />
          </div>
          <div className="pt-4">
            <KeyValueList
              items={[
                { label: 'Moteur', value: database.engine },
                { label: 'Retard du réplica', value: `${formatDecimal(database.replicaLagMs / 1000)} seconde` },
                { label: 'Requêtes lentes', value: `${formatInteger(database.slowQueries)} au-dessus de 500 ms, 24 h` },
                { label: 'Dernière sauvegarde', value: formatDateTime(database.lastBackupAt) },
              ]}
            />
          </div>
        </Section>
        <Section id="latence" title="Latence p95 de l’API, 24 heures">
          <p className="pb-2 text-caption text-fg-subtle">En millisecondes · objectif : {formatInteger(data.p95TargetMs)}</p>
          <LatencyChart points={data.latency} target={data.p95TargetMs} />
        </Section>
      </div>
      <OpenIncidentDialog open={incidentOpen} onOpenChange={setIncidentOpen} />
    </div>
  );
}
