'use client';

import { Alert, Badge } from '@eguardimmo/ui';
import { useState } from 'react';
import { ActionMenu, ListLoading, LoadError, NotFoundPanel, PageHeader } from '../locataires/kit';
import type { ActionItem } from '../locataires/kit';
import { links } from '../locataires/kit/links';
import { FilesCard } from './cards/FilesCard';
import { InvoicesCard } from './cards/InvoicesCard';
import { QuotesCard } from './cards/QuotesCard';
import { SummaryCard } from './cards/SummaryCard';
import { TimelineCard } from './cards/TimelineCard';
import { VisitsCard } from './cards/VisitsCard';
import { DialogHost } from './dialogs/DialogHost';
import type { DialogRequest } from './dialogs/DialogHost';
import { interventionActions } from './actions';
import { useIntervention, useMaintenancePermissions, useNatureTerms } from './hooks';
import { MaintenanceApiError } from './api/maintenanceErrors';
import { MaintenanceGate } from './MaintenanceGate';
import { priorityBadge, statusBadge } from './labels';
import { maintenancePaths } from './paths';
import type { InterventionDetail } from './model';

export function InterventionDetailPage({ id }: { id: string }) {
  return (
    <MaintenanceGate>
      <Detail id={id} />
    </MaintenanceGate>
  );
}

const crumbs = (reference: string) => [{ label: 'Accueil', href: links.home }, { label: 'Interventions', href: maintenancePaths.interventions }, { label: reference }];

function Detail({ id }: { id: string }) {
  const query = useIntervention(id);
  const permissions = useMaintenancePermissions();
  const natures = useNatureTerms();
  const [open, setOpen] = useState<{ request: DialogRequest; snapshot: InterventionDetail } | null>(null);

  if (query.isPending && !query.isError) return <ListLoading label="Chargement de l’intervention" />;
  if (query.error instanceof MaintenanceApiError && query.error.kind === 'not_found') {
    return <NotFoundPanel title="Intervention introuvable" description="Cette intervention n’existe pas ou n’appartient pas à votre organisation." backHref={maintenancePaths.interventions} backLabel="Retour aux interventions" />;
  }
  if (query.isError || !query.data) return <LoadError title={query.error?.message ?? 'L’intervention n’a pas pu être chargée'} />;

  const intervention = query.data;
  const actions = interventionActions(intervention, permissions);
  const show = (request: DialogRequest) => { setOpen({ request, snapshot: intervention }); };
  const menu: ActionItem[] = [
    ...(actions.qualify ? [{ id: 'qualify', label: 'Qualifier', onSelect: () => { show({ name: 'qualify' }); } }] : []),
    ...(actions.assign ? [{ id: 'assign', label: intervention.supplier ? 'Changer de prestataire' : 'Assigner un prestataire', onSelect: () => { show({ name: 'assign' }); } }] : []),
    ...(actions.engage ? [{ id: 'engage', label: 'Engager les travaux', onSelect: () => { show({ name: 'engage' }); } }] : []),
    ...(actions.complete ? [{ id: 'complete', label: 'Marquer terminée', onSelect: () => { show({ name: 'complete' }); } }] : []),
    ...(actions.close ? [{ id: 'close', label: 'Clôturer', onSelect: () => { show({ name: 'close' }); } }] : []),
    ...(actions.reopen ? [{ id: 'reopen', label: 'Rouvrir', onSelect: () => { show({ name: 'reopen' }); } }] : []),
    ...(actions.decline ? [{ id: 'decline', label: 'Classer sans suite', tone: 'danger' as const, separatorBefore: true, onSelect: () => { show({ name: 'decline' }); } }] : []),
    ...(actions.cancel ? [{ id: 'cancel', label: 'Annuler l’intervention', tone: 'danger' as const, onSelect: () => { show({ name: 'cancel' }); } }] : []),
  ];

  return (
    <>
      <PageHeader
        crumbs={crumbs(intervention.reference)}
        title={intervention.title}
        subtitle={intervention.reference}
        badges={
          <>
            <Badge tone={statusBadge[intervention.status].tone}>{statusBadge[intervention.status].label}</Badge>
            <Badge tone={priorityBadge[intervention.priority].tone}>{priorityBadge[intervention.priority].label}</Badge>
          </>
        }
        actions={menu.length > 0 ? <ActionMenu label="Actions sur l’intervention" items={menu} /> : null}
      />
      {intervention.ceilingAmount && intervention.estimatedAmount && intervention.estimatedAmount.amount > intervention.ceilingAmount.amount ? (
        <Alert tone="warning" title="Estimation supérieure au plafond du mandat">L’accord du mandant est requis avant d’engager les travaux.</Alert>
      ) : null}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <SummaryCard intervention={intervention} natures={natures.data ?? []} />
          <FilesCard intervention={intervention} canAdd={actions.addFile} canWrite={permissions.write} onAdd={() => { show({ name: 'file' }); }} />
          <TimelineCard intervention={intervention} canComment={actions.comment} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <QuotesCard intervention={intervention} canAdd={actions.addQuote} canWrite={permissions.write} onAdd={() => { show({ name: 'quote' }); }} onDecide={(approval) => { show({ name: 'decision', approval }); }} />
          <VisitsCard intervention={intervention} canAdd={actions.addVisit} canWrite={permissions.write} onAdd={() => { show({ name: 'visit' }); }} />
          <InvoicesCard
            intervention={intervention}
            permissions={permissions}
            canRecord={actions.recordInvoice}
            onRecord={() => { show({ name: 'invoice' }); }}
            onAllocate={(invoice) => { show({ name: 'allocate', invoice }); }}
            onPay={(invoice) => { show({ name: 'pay', invoice }); }}
          />
        </div>
      </div>
      <DialogHost request={open?.request ?? null} intervention={open?.snapshot ?? intervention} onClose={() => { setOpen(null); }} />
    </>
  );
}
