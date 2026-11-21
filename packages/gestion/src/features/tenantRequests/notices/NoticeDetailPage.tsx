'use client';

import { Alert, Badge, Button, Icon } from '@eguardimmo/ui';
import { CalendarCheck, DoorOpen, UserMinus } from 'lucide-react';
import { useState } from 'react';
import { DescriptionList, PageHeader, SectionCard, useGestionNavigation } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';
import { RoleGate, canManage } from '../shared/access';
import { useLeaseLabels } from '../shared/hooks';
import { DownloadButton } from '../shared/parts/DownloadButton';
import { QueryState } from '../shared/parts/QueryState';
import { tenantRequestsPaths } from '../shared/paths';
import { AcknowledgeDialog } from './AcknowledgeDialog';
import { EndParticipantDialog, RecordLeaseNoticeDialog } from './CloseDialogs';
import { useNoticeRequest } from './hooks';
import { isLate, isLive, noticeStatusBadge, outcomeLabel, reasonLabel } from './model';
import type { NoticeRequest } from './model';
import { useNoticesSource } from './source';

const CRUMBS = [{ label: 'Baux', href: '/baux' }, { label: 'Demandes de congé', href: tenantRequestsPaths.notices }, { label: 'Demande' }];

export function NoticeDetailPage({ id }: { id: string }) {
  return (
    <RoleGate allowed={canManage} title="Demande de congé" crumbs={CRUMBS} message="Les demandes de congé des locataires sont réservées au propriétaire, à l’administrateur et au gestionnaire de l’organisation.">
      <NoticeDetailContent id={id} />
    </RoleGate>
  );
}

function NoticeDetailContent({ id }: { id: string }) {
  const notice = useNoticeRequest(id);
  if (notice.data) return <NoticeDetail notice={notice.data} />;
  return (
    <>
      <PageHeader crumbs={[{ label: 'Accueil', href: links.home }, ...CRUMBS]} title="Demande de congé" />
      <QueryState
        query={notice}
        label="Chargement de la demande"
        title="Impossible de charger la demande"
        notFound={{ title: 'Demande introuvable', description: 'Cette demande n’existe pas dans votre organisation.', backHref: tenantRequestsPaths.notices, backLabel: 'Retour aux demandes de congé' }}
      />
    </>
  );
}

type Dialogs = 'acknowledge' | 'lease' | 'participant' | null;

function NoticeDetail({ notice }: { notice: NoticeRequest }) {
  const { Link } = useGestionNavigation();
  const source = useNoticesSource();
  const labels = useLeaseLabels([notice.leaseId]);
  const [dialog, setDialog] = useState<Dialogs>(null);
  const badge = noticeStatusBadge[notice.status];
  const tenant = labels.tenantOf(notice.leaseId, notice.partyId);
  const live = isLive(notice);

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, ...CRUMBS]}
        title={`Congé de ${tenant}`}
        subtitle={`Bail ${labels.referenceOf(notice.leaseId)}`}
        badges={
          <>
            <Badge tone={badge.tone}>{badge.label}</Badge>
            {isLate(notice) ? <Badge tone="danger">En retard</Badge> : null}
          </>
        }
        actions={
          live ? (
            <>
              {notice.status === 'submitted' ? (
                <Button variant="primary" onClick={() => { setDialog('acknowledge'); }}>
                  <Icon icon={CalendarCheck} />
                  Accuser réception
                </Button>
              ) : null}
              <Button variant={notice.status === 'acknowledged' ? 'primary' : 'secondary'} onClick={() => { setDialog('lease'); }}>
                <Icon icon={DoorOpen} />
                Enregistrer le congé
              </Button>
              <Button variant="secondary" onClick={() => { setDialog('participant'); }}>
                <Icon icon={UserMinus} />
                Départ de ce locataire seul
              </Button>
            </>
          ) : null
        }
      />
      {isLate(notice) ? (
        <Alert tone="warning" title="Accusé de réception en retard">
          Cette demande attend un accusé de réception au-delà du délai prévu. Le locataire a été prévenu.
        </Alert>
      ) : null}
      {notice.status === 'closed' && notice.closedOutcome ? <Alert tone="info" title="Demande clôturée">{outcomeLabel[notice.closedOutcome]}.</Alert> : null}
      <SectionCard id="notice-summary" title="Demande">
        <DescriptionList
          termWidth="180px"
          items={[
            { term: 'Locataire', detail: tenant },
            { term: 'Bail', detail: <Link href={tenantRequestsPaths.lease(notice.leaseId)} className="text-action-on-subtle underline-offset-2 hover:underline">{labels.referenceOf(notice.leaseId)}</Link> },
            { term: 'Motif', detail: reasonLabel(notice.reasonKey) },
            { term: 'Déposée le', detail: formatDateFr(notice.createdAt) },
            { term: 'Départ souhaité', detail: formatDateFr(notice.requestedDepartureOn) },
            { term: notice.status === 'submitted' ? 'Premier départ possible (indicatif)' : 'Premier départ possible', detail: formatDateFr(notice.earliestDepartureOn) },
            { term: 'Reçue le', detail: notice.receivedOn === null ? 'Accusé non posé' : formatDateFr(notice.receivedOn) },
            { term: 'Adresse de réexpédition', detail: notice.forwardingAddress ?? 'Non communiquée' },
          ]}
        />
      </SectionCard>
      <SectionCard id="notice-files" title="Pièces">
        <p className="text-caption text-fg-subtle">Le justificatif est lisible par le propriétaire, l’administrateur et le gestionnaire ; chaque téléchargement est journalisé.</p>
        <div className="flex flex-wrap items-start gap-2">
          {notice.hasProof ? (
            <DownloadButton load={() => source.downloadProof(notice.id)} filename={`justificatif-conge-${notice.id}.pdf`} failureTitle="Justificatif non téléchargé">Télécharger le justificatif</DownloadButton>
          ) : (
            <span className="text-body text-fg-subtle">Aucun justificatif joint.</span>
          )}
        </div>
        {notice.letterFingerprint === null ? null : <p className="break-all text-caption text-fg-subtle">{`Empreinte de la lettre (SHA-256) : ${notice.letterFingerprint}`}</p>}
      </SectionCard>
      <AcknowledgeDialog notice={notice} open={dialog === 'acknowledge'} onClose={() => { setDialog(null); }} />
      <RecordLeaseNoticeDialog notice={notice} open={dialog === 'lease'} onClose={() => { setDialog(null); }} />
      <EndParticipantDialog notice={notice} open={dialog === 'participant'} onClose={() => { setDialog(null); }} />
    </>
  );
}
