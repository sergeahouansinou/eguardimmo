'use client';

import { Alert, Badge, StatCard } from '@eguardimmo/ui';
import { BundlesCard } from './BundlesCard';
import { CaseItemsCard } from './CaseItemsCard';
import { CaseStatusControls } from './CaseStatusControls';
import { DiligencesCard } from './DiligencesCard';
import { RecoveryApiError } from './api/recoveryErrors';
import { useCase } from './hooks';
import { caseBadge } from './labels';
import type { RecoveryCase } from './model';
import { recoveryPaths } from './paths';
import { moneyText } from '../rent/labels';
import { ListLoading, LoadError, NotFoundPanel, PageHeader } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';

export function CaseDetailPage({ id }: { id: string }) {
  const found = useCase(id);
  const crumbs = [{ label: 'Accueil', href: links.home }, { label: 'Recouvrement', href: recoveryPaths.cases }];
  if (found.isError) {
    if (found.error instanceof RecoveryApiError && found.error.kind === 'not_found') {
      return (
        <>
          <PageHeader crumbs={[...crumbs, { label: 'Introuvable' }]} title="Dossier introuvable" />
          <NotFoundPanel title="Ce dossier n’existe pas" description="Il n’appartient pas à votre organisation ou le lien est incorrect." backHref={recoveryPaths.cases} backLabel="Retour au recouvrement" />
        </>
      );
    }
    return (
      <>
        <PageHeader crumbs={[...crumbs, { label: 'Dossier' }]} title="Dossier de recouvrement" />
        <LoadError title={found.error?.message ?? 'Le dossier n’a pas pu être chargé'} />
      </>
    );
  }
  if (!found.data) {
    return (
      <>
        <PageHeader crumbs={[...crumbs, { label: 'Dossier' }]} title="Dossier de recouvrement" />
        <ListLoading label="Chargement du dossier" />
      </>
    );
  }
  return <Detail recoveryCase={found.data} crumbs={crumbs} />;
}

function Detail({ recoveryCase, crumbs }: { recoveryCase: RecoveryCase; crumbs: { label: string; href: string }[] }) {
  const badge = caseBadge[recoveryCase.status];
  const ended = recoveryCase.status === 'closed' || recoveryCase.status === 'uncollectible';
  return (
    <>
      <PageHeader
        crumbs={[...crumbs, { label: recoveryCase.number }]}
        title={`Dossier ${recoveryCase.number}`}
        subtitle={`${recoveryCase.debtorName ?? 'Locataire inconnu'}${recoveryCase.leaseReference ? `, bail ${recoveryCase.leaseReference}` : ''}`}
        badges={<Badge tone={badge.tone}>{badge.label}</Badge>}
        actions={<CaseStatusControls recoveryCase={recoveryCase} />}
      />
      {ended ? (
        <Alert tone="info" title={recoveryCase.status === 'closed' ? 'Dossier clos' : 'Dossier irrécouvrable'}>
          {`${recoveryCase.closedOn ? `Depuis le ${formatDateFr(recoveryCase.closedOn)}. ` : ''}${recoveryCase.statusReason ? `Motif : ${recoveryCase.statusReason}. ` : ''}Il n’accepte plus de modification.`}
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Reste dû" value={moneyText(recoveryCase.outstanding)} tone={recoveryCase.outstanding.amount > 0 ? 'danger' : 'default'} />
        <StatCard label="Créances" value={String(recoveryCase.itemsCount)} />
        <StatCard label="Ouvert le" value={formatDateFr(recoveryCase.openedOn)} />
        <StatCard label="Envois générés" value={String(recoveryCase.bundles.length)} />
      </div>
      <CaseItemsCard recoveryCase={recoveryCase} />
      <DiligencesCard recoveryCase={recoveryCase} />
      <BundlesCard recoveryCase={recoveryCase} />
    </>
  );
}
