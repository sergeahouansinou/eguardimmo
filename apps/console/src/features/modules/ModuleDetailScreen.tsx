'use client';

import { Alert, Badge, Button, Icon, Switch } from '@eguardimmo/ui';
import { Pause, Play, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useSetFlag, useSetPaused } from '@/console/hooks/mutations';
import { useModule } from '@/console/hooks/queries';
import type { ModuleDetail } from '@/console/schemas';
import { formatDate, formatDateTime, formatInteger, formatTime } from '@/lib/format';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { PageHeader } from '@/ui/PageHeader';
import { QueryState } from '@/ui/QueryState';
import { EmptyLine, KeyValueList, ListRow, Section } from '@/ui/Section';
import { useNotify } from '@/ui/notify';
import { ModuleStateBadge } from './ModulesScreen';

export function ModuleDetailScreen({ id }: { id: string }) {
  const query = useModule(id);
  return (
    <QueryState
      query={query}
      label="Le module"
      notFound={{
        title: 'Module introuvable',
        description: 'Ce module n’existe pas dans le catalogue de l’API.',
        backHref: '/modules',
        backLabel: 'Retour aux modules',
      }}
    >
      {(detail) => <DetailContent detail={detail} />}
    </QueryState>
  );
}

function DetailContent({ detail }: { detail: ModuleDetail }) {
  const { module } = detail;
  const notify = useNotify();
  const setFlag = useSetFlag(module.id);
  const setPaused = useSetPaused(module.id);
  const [pauseOpen, setPauseOpen] = useState(false);
  const pauseLabel = module.id === 'messagerie' ? 'les envois' : 'le module';

  const toggleFlag = (key: string, label: string, enabled: boolean) => {
    setFlag.mutate(
      { key, enabled },
      {
        onSuccess: () => { notify.success(`${label} : ${enabled ? 'activé' : 'désactivé'}`, 'Le changement est consigné au journal d’audit.'); },
        onError: () => { notify.error('Changement impossible', 'Réessayez dans un instant.'); },
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        breadcrumb={[{ label: 'Modules', href: '/modules' }, { label: module.name }]}
        title={module.name}
        badges={
          <>
            <ModuleStateBadge state={module.state} />
            <Badge tone="neutral">{module.version}</Badge>
            {detail.paused ? <Badge tone="warning">En pause</Badge> : null}
          </>
        }
        subtitle={`${module.description} · actif dans ${formatInteger(module.organisationsActive)} organisations sur ${formatInteger(module.organisationsTotal)}`}
        actions={
          <>
            {module.mandatory ? null : (
              <Button variant="secondary" onClick={() => { setPauseOpen(true); }}>
                <Icon icon={detail.paused ? Play : Pause} />
                {detail.paused ? `Reprendre ${pauseLabel}` : `Mettre en pause ${pauseLabel}`}
              </Button>
            )}
            {detail.incident ? (
              <Button variant="secondary" asChild>
                <Link href={`/sante/incidents/${detail.incident.id}`}>
                  <Icon icon={TriangleAlert} />
                  Voir l’incident
                </Link>
              </Button>
            ) : null}
          </>
        }
      />
      {detail.incident ? (
        <Alert tone="warning" title={`Incident ${detail.incident.code} en cours depuis ${formatTime(detail.incident.openedAt)}`}>
          {detail.incident.summary}
        </Alert>
      ) : null}
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {detail.kpis.map((kpi) => (
          <div key={kpi.label} className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-line bg-surface px-4 py-3">
            <dt className="text-caption text-fg-subtle">{kpi.label}</dt>
            <dd className={kpi.tone === 'danger' ? 'text-[18px] leading-7 font-semibold text-fg-danger' : 'text-[18px] leading-7 font-semibold'}>
              {kpi.value}
            </dd>
            <dd className="text-caption text-fg-subtle">{kpi.caption}</dd>
          </div>
        ))}
      </dl>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Section
          id="drapeaux"
          title="Drapeaux de fonctionnalité"
          aside={<span className="text-caption text-fg-subtle">{`${String(detail.flags.length)} drapeaux`}</span>}
        >
          {detail.flags.length === 0 ? (
            <EmptyLine>Aucun drapeau pour ce module.</EmptyLine>
          ) : (
            <ul>
              {detail.flags.map((flag) => (
                <ListRow
                  key={flag.key}
                  title={flag.label}
                  detail={`${flag.key}${flag.detail ? ` · ${flag.detail}` : ''}`}
                  trailing={
                    <>
                      {flag.badge ? <Badge tone={flag.badge.tone}>{flag.badge.label}</Badge> : null}
                      <Switch label={flag.label} hideLabel checked={flag.enabled} onCheckedChange={(next) => { toggleFlag(flag.key, flag.label, next); }} />
                    </>
                  }
                />
              ))}
            </ul>
          )}
        </Section>
        <Section id="informations" title="Informations">
          <KeyValueList
            items={[
              { label: 'Version', value: `${module.version.slice(1)}, déployée le ${formatDate('2026-11-10')}` },
              { label: 'Fournisseur d’envoi', value: detail.provider },
              { label: 'Responsable', value: detail.responsible },
              { label: 'Dernier incident', value: detail.lastIncidentAt ? formatDateTime(detail.lastIncidentAt) : 'Aucun' },
              { label: 'Organisations actives', value: `${formatInteger(module.organisationsActive)} sur ${formatInteger(module.organisationsTotal)}` },
              { label: 'Runbook', value: detail.runbook ?? 'Aucun' },
            ]}
          />
        </Section>
        <Section id="dependances" title="Dépendances">
          <p className="pt-1 text-caption font-semibold text-fg-muted">S’appuie sur</p>
          {detail.dependsOn.length === 0 ? (
            <EmptyLine>Aucune dépendance.</EmptyLine>
          ) : (
            <ul>
              {detail.dependsOn.map((dependency) => (
                <ListRow
                  key={dependency.id}
                  title={
                    <Link href={`/modules/${dependency.id}`} className="hover:underline">
                      {dependency.name}
                    </Link>
                  }
                  detail={dependency.detail}
                  trailing={<ModuleStateBadge state={dependency.state} />}
                />
              ))}
            </ul>
          )}
          <p className="pt-3 text-caption font-semibold text-fg-muted">Utilisé par</p>
          {detail.usedBy.length === 0 ? (
            <EmptyLine>Aucun module ne dépend de celui-ci.</EmptyLine>
          ) : (
            <ul>
              {detail.usedBy.map((user) => (
                <ListRow
                  key={user.id}
                  title={
                    <Link href={`/modules/${user.id}`} className="hover:underline">
                      {user.name}
                    </Link>
                  }
                  detail={user.detail}
                  trailing={<Badge tone={user.impacted ? 'warning' : 'neutral'}>{user.impacted ? 'Impacté' : 'Non impacté'}</Badge>}
                />
              ))}
            </ul>
          )}
        </Section>
        <Section
          id="versions"
          title="Versions"
          aside={<span className="text-caption text-fg-subtle">{`${formatInteger(detail.versionTotal)} versions`}</span>}
        >
          <ul>
            {detail.versions.map((version) => (
              <ListRow
                key={version.version}
                title={version.version}
                detail={`${formatDate(version.on)} · ${version.note}`}
                trailing={version.current ? <Badge tone="success">En production</Badge> : undefined}
              />
            ))}
          </ul>
        </Section>
      </div>
      <ConfirmDialog
        open={pauseOpen}
        onOpenChange={setPauseOpen}
        title={detail.paused ? `Reprendre ${pauseLabel}` : `Mettre en pause ${pauseLabel}`}
        description={
          detail.paused
            ? 'Le traitement reprend et les éléments en attente sont envoyés. L’action est consignée au journal d’audit.'
            : 'Les éléments en attente sont conservés et partiront à la reprise. L’action est consignée au journal d’audit.'
        }
        confirmLabel={detail.paused ? 'Reprendre' : 'Mettre en pause'}
        tone={detail.paused ? 'primary' : 'danger'}
        onConfirm={async () => {
          await setPaused.mutateAsync(!detail.paused);
          notify.success(detail.paused ? 'Module repris' : 'Module en pause', 'Le changement est consigné au journal d’audit.');
        }}
      />
    </div>
  );
}
