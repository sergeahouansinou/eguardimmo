'use client';

import { Alert, Badge, Button, Tab, TabList, TabPanel, Tabs, useToast } from '@eguardimmo/ui';
import Link from 'next/link';
import { useState } from 'react';
import { useOperator } from '@/espace/useOperator';
import { problemText } from '@/platform/errors';
import type { Plan, PlanVersion } from '@/platform/plans/plans';
import { hasRole } from '@/platform/roles';
import { PageHeader } from '@/ui/PageHeader';
import { PlatformState } from '@/ui/PlatformState';
import { ApprovalRequestDialog } from '@/screens/shared/ApprovalRequestDialog';
import { usePendingApproval } from '@/screens/shared/usePendingApproval';
import { DraftEditor } from './DraftEditor';
import { useCreateDraft, usePlan } from './hooks';
import { VERSION_STATUS_LABELS, VERSION_STATUS_TONES } from './labels';
import { VersionView } from './VersionView';

const PUBLISH = 'subscriptions.plan_version.publish';

function initialVersion(plan: Plan): string {
  const sorted = [...plan.versions].sort((a, b) => b.version - a.version);
  return (sorted.find((v) => v.status === 'draft') ?? sorted[0])?.id ?? '';
}

function DraftActions({ plan, version, canWrite }: { plan: Plan; version: PlanVersion; canWrite: boolean }) {
  const [editing, setEditing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const pending = usePendingApproval(version.id, [PUBLISH]);
  if (editing) return <DraftEditor version={version} onDone={() => { setEditing(false); }} />;
  return (
    <div className="flex flex-col gap-3">
      {pending ? (
        <Alert tone="info" title="En attente d’un second opérateur">
          Une demande de publication a été déposée par {pending.requestedBy.name ?? 'un opérateur'}.{' '}
          <Link href="/approbations" className="underline">
            Voir les approbations
          </Link>
        </Alert>
      ) : null}
      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => { setEditing(true); }}>
            Modifier le brouillon
          </Button>
          {pending ? null : <Button onClick={() => { setPublishing(true); }}>Demander la publication</Button>}
        </div>
      ) : null}
      <VersionView version={version} />
      <ApprovalRequestDialog
        open={publishing}
        onOpenChange={setPublishing}
        title={`Publier la version ${String(version.version)} de ${plan.name}`}
        description="Une version publiée ne se modifie plus. Un second opérateur doit valider cette publication."
        action={PUBLISH}
        subjectId={version.id}
        submitLabel="Demander la publication"
      />
    </div>
  );
}

function PlanContent({ plan }: { plan: Plan }) {
  const { show } = useToast();
  const operator = useOperator();
  const canWrite = operator.data !== undefined && hasRole(operator.data.roles, 'billing');
  const [selected, setSelected] = useState(() => initialVersion(plan));
  const [failure, setFailure] = useState<string | null>(null);
  const create = useCreateDraft();
  const versions = [...plan.versions].sort((a, b) => b.version - a.version);
  const hasDraft = versions.some((version) => version.status === 'draft');
  const current = versions.some((version) => version.id === selected) ? selected : initialVersion(plan);

  const openDraft = () => {
    setFailure(null);
    create.mutate(plan.code, {
      onSuccess: (version) => {
        setSelected(version.id);
        show({ tone: 'success', title: 'Brouillon ouvert', description: `La version ${String(version.version)} est prête à être modifiée.` });
      },
      onError: (error) => { setFailure(problemText(error)); },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        title={plan.name}
        subtitle={<span className="font-mono">{plan.code}</span>}
        breadcrumb={[{ label: 'Abonnements', href: '/abonnements' }, { label: plan.name }]}
        actions={canWrite && !hasDraft ? <Button onClick={openDraft} loading={create.isPending}>Ouvrir un brouillon</Button> : undefined}
      />
      {failure ? <Alert tone="danger">{failure}</Alert> : null}
      {versions.length === 0 ? (
        <Alert tone="info">Ce plan n’a encore aucune version.</Alert>
      ) : (
        <Tabs value={current} defaultValue={current} onValueChange={setSelected}>
          <TabList aria-label="Versions du plan">
            {versions.map((version) => (
              <Tab key={version.id} value={version.id}>
                {`Version ${String(version.version)} · ${VERSION_STATUS_LABELS[version.status]}`}
              </Tab>
            ))}
          </TabList>
          {versions.map((version) => (
            <TabPanel key={version.id} value={version.id} className="pt-2">
              <div className="mb-2">
                <Badge tone={VERSION_STATUS_TONES[version.status]}>{VERSION_STATUS_LABELS[version.status]}</Badge>
              </div>
              {version.status === 'draft' ? <DraftActions plan={plan} version={version} canWrite={canWrite} /> : <VersionView version={version} />}
            </TabPanel>
          ))}
        </Tabs>
      )}
    </div>
  );
}

export function PlanScreen({ code }: { code: string }) {
  const query = usePlan(code);
  return (
    <PlatformState
      query={query}
      label="Le plan"
      notFound={{ title: 'Plan introuvable', description: 'Ce plan n’existe pas.', backHref: '/abonnements', backLabel: 'Retour aux abonnements' }}
    >
      {(plan) => <PlanContent key={plan.id} plan={plan} />}
    </PlatformState>
  );
}
