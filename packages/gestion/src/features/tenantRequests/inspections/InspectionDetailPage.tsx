'use client';

import { Alert, Badge, Button, Icon } from '@eguardimmo/ui';
import { Pencil, Send } from 'lucide-react';
import { useState } from 'react';
import { DescriptionList, PageHeader, SectionCard, useGestionNavigation, useNotify } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';
import { RoleGate, canManage } from '../shared/access';
import { useLeaseLabels } from '../shared/hooks';
import { ConfirmAction } from '../shared/parts/ConfirmAction';
import { DownloadButton } from '../shared/parts/DownloadButton';
import { QueryState } from '../shared/parts/QueryState';
import { tenantRequestsPaths } from '../shared/paths';
import { EditInspectionDialog } from './EditInspectionDialog';
import { useInspection, usePublishInspection } from './hooks';
import { conformityLabel, isPublished, kindLabel, performerLabel, publicationBadge } from './model';
import type { Inspection } from './model';
import { RemarksSection } from './RemarksSection';
import { useInspectionsSource } from './source';

const CRUMBS = [{ label: 'Baux', href: '/baux' }, { label: 'États des lieux', href: tenantRequestsPaths.inspections }, { label: 'État des lieux' }];

export function InspectionDetailPage({ id }: { id: string }) {
  return (
    <RoleGate allowed={canManage} title="État des lieux" crumbs={CRUMBS} message="Les états des lieux sont réservés au propriétaire, à l’administrateur et au gestionnaire de l’organisation.">
      <InspectionDetailContent id={id} />
    </RoleGate>
  );
}

function InspectionDetailContent({ id }: { id: string }) {
  const inspection = useInspection(id);
  if (inspection.data) return <InspectionDetail inspection={inspection.data} />;
  return (
    <>
      <PageHeader crumbs={[{ label: 'Accueil', href: links.home }, ...CRUMBS]} title="État des lieux" />
      <QueryState
        query={inspection}
        label="Chargement de l’état des lieux"
        title="Impossible de charger l’état des lieux"
        notFound={{ title: 'État des lieux introuvable', description: 'Cet état des lieux n’existe pas dans votre organisation.', backHref: tenantRequestsPaths.inspections, backLabel: 'Retour aux états des lieux' }}
      />
    </>
  );
}

type Dialogs = 'edit' | 'publish' | null;

function InspectionDetail({ inspection }: { inspection: Inspection }) {
  const { Link } = useGestionNavigation();
  const source = useInspectionsSource();
  const publish = usePublishInspection();
  const notify = useNotify();
  const labels = useLeaseLabels([inspection.leaseId]);
  const [dialog, setDialog] = useState<Dialogs>(null);
  const badge = publicationBadge(inspection);
  const published = isPublished(inspection);

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, ...CRUMBS]}
        title={kindLabel[inspection.kind]}
        subtitle={`Bail ${labels.referenceOf(inspection.leaseId)}`}
        badges={<Badge tone={badge.tone}>{badge.label}</Badge>}
        actions={
          published ? null : (
            <>
              <Button variant="secondary" onClick={() => { setDialog('edit'); }}>
                <Icon icon={Pencil} />
                Modifier
              </Button>
              <Button variant="primary" onClick={() => { setDialog('publish'); }}>
                <Icon icon={Send} />
                Publier
              </Button>
            </>
          )
        }
      />
      {published ? (
        <Alert tone="info" title="État des lieux publié et figé">Les locataires du bail peuvent le lire. Pour corriger une erreur, enregistrez un nouvel état des lieux.</Alert>
      ) : (
        <Alert tone="warning" title="Invisible du locataire">Le locataire ne le voit qu’après publication.</Alert>
      )}
      <SectionCard id="inspection-summary" title="Synthèse">
        <DescriptionList
          termWidth="180px"
          items={[
            { term: 'Type', detail: kindLabel[inspection.kind] },
            { term: 'Bail', detail: <Link href={tenantRequestsPaths.lease(inspection.leaseId)} className="text-action-on-subtle underline-offset-2 hover:underline">{labels.referenceOf(inspection.leaseId)}</Link> },
            { term: 'Réalisé le', detail: formatDateFr(inspection.performedOn) },
            { term: 'Réalisé par', detail: performerLabel[inspection.performedBy] },
            ...(inspection.kind === 'exit' ? [{ term: 'Conformité', detail: conformityLabel(inspection.exitMatchesEntry) }] : []),
            { term: 'Publié le', detail: formatDateFr(inspection.publishedAt) },
          ]}
        />
        <div className="flex flex-wrap items-start gap-2">
          <DownloadButton load={() => source.downloadDocument(inspection.id)} filename={`etat-des-lieux-${inspection.kind}-${inspection.performedOn}.pdf`} failureTitle="PDF non téléchargé">Télécharger le PDF</DownloadButton>
        </div>
      </SectionCard>
      <SectionCard id="inspection-signatories" title="Signataires déclarés">
        {inspection.signatories.length === 0 ? (
          <p className="text-body text-fg-subtle">Aucun signataire déclaré.</p>
        ) : (
          <ul className="flex flex-col">
            {inspection.signatories.map((signatory, index) => (
              <li key={`${signatory.name}-${String(index)}`} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-1.5 first:border-t-0">
                <span className="text-body text-fg"><b>{signatory.name}</b>{`, ${signatory.capacity}`}</span>
                <span className="text-caption text-fg-subtle">{`Signé le ${formatDateFr(signatory.date)}`}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <RemarksSection inspection={inspection} />
      <EditInspectionDialog inspection={inspection} open={dialog === 'edit'} onClose={() => { setDialog(null); }} />
      <ConfirmAction
        open={dialog === 'publish'}
        title="Publier l’état des lieux"
        description="Les locataires du bail pourront le lire et le télécharger, et seront prévenus. Une fois publié, il est figé : pour le corriger, il faudra enregistrer un nouvel état des lieux."
        confirmLabel="Publier"
        failureTitle="État des lieux non publié"
        run={async () => {
          await publish.mutateAsync(inspection.id);
          notify({ title: 'État des lieux publié', description: 'Les locataires du bail en sont informés.' });
        }}
        onClose={() => { setDialog(null); }}
      />
    </>
  );
}
