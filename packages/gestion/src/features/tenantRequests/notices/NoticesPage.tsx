'use client';

import { Alert, Badge, Card, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { useState } from 'react';
import { CursorPager, useCursorPages } from '../../finances/rent/CursorPager';
import { ListLoading, LoadError, NoRows, PageHeader, useGestionNavigation } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';
import { RoleGate, canManage } from '../shared/access';
import { useLeaseLabels } from '../shared/hooks';
import { tenantRequestsPaths } from '../shared/paths';
import { useNoticeRequests } from './hooks';
import { NOTICE_STATUSES, isLate, noticeStatusBadge, reasonLabel } from './model';
import type { NoticeQuery } from './model';

const ALL = '';
const CRUMBS = [{ label: 'Baux', href: '/baux' }, { label: 'Demandes de congé' }];

export function NoticesPage() {
  return (
    <RoleGate allowed={canManage} title="Demandes de congé" crumbs={CRUMBS} message="Les demandes de congé des locataires sont réservées au propriétaire, à l’administrateur et au gestionnaire de l’organisation.">
      <NoticesContent />
    </RoleGate>
  );
}

function NoticesContent() {
  const { search } = useGestionNavigation();
  const leaseId = search.get('bail');
  const pages = useCursorPages();
  const [status, setStatus] = useState(ALL);
  const query: NoticeQuery = { cursor: pages.cursor, status: NOTICE_STATUSES.find((value) => value === status) ?? null, leaseId };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, ...CRUMBS]}
        title="Demandes de congé"
        subtitle="Le locataire demande, l’agence acte : accusez réception à la date de remise, puis enregistrez le congé sur le bail."
      />
      <LateAlert />
      <Card role="region" aria-label="Liste des demandes de congé" className="gap-3">
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Statut"
            placeholder="Tous les statuts"
            options={[{ value: ALL, label: 'Tous les statuts' }, ...NOTICE_STATUSES.map((value) => ({ value, label: noticeStatusBadge[value].label }))]}
            value={status}
            onValueChange={(value) => { setStatus(value); pages.reset(); }}
          />
        </div>
        <NoticesTable query={query} pages={pages} />
      </Card>
    </>
  );
}

function LateAlert() {
  const { Link } = useGestionNavigation();
  const waiting = useNoticeRequests({ cursor: null, status: 'submitted', leaseId: null });
  const late = (waiting.data?.items ?? []).filter(isLate).length;
  if (late === 0) return null;
  return (
    <Alert tone="warning" title={`${String(late)} demande${late > 1 ? 's' : ''} sans accusé de réception dans le délai`}>
      Le locataire a été prévenu et l’écran lui propose d’envoyer sa lettre en recommandé.{' '}
      <Link href={tenantRequestsPaths.notices} className="text-action-on-subtle underline underline-offset-2">Traiter les demandes</Link>
    </Alert>
  );
}

function NoticesTable({ query, pages }: { query: NoticeQuery; pages: ReturnType<typeof useCursorPages> }) {
  const { Link } = useGestionNavigation();
  const notices = useNoticeRequests(query);
  const labels = useLeaseLabels(notices.data?.items.map((notice) => notice.leaseId) ?? []);
  if (notices.isPending) return <ListLoading label="Chargement des demandes de congé" />;
  if (notices.isError || notices.data === undefined) return <LoadError title="Impossible de charger les demandes de congé" />;
  if (notices.data.items.length === 0) return <NoRows>{query.status !== null || query.leaseId !== null ? 'Aucune demande ne correspond à ces filtres.' : 'Aucune demande de congé. Elles arrivent ici quand un locataire en dépose une depuis son espace.'}</NoRows>;

  return (
    <>
      <Table aria-label="Demandes de congé">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Locataire</TableHeaderCell>
            <TableHeaderCell>Bail</TableHeaderCell>
            <TableHeaderCell>Motif</TableHeaderCell>
            <TableHeaderCell>Départ souhaité</TableHeaderCell>
            <TableHeaderCell>Déposée le</TableHeaderCell>
            <TableHeaderCell>Statut</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {notices.data.items.map((notice) => {
            const badge = noticeStatusBadge[notice.status];
            return (
              <TableRow key={notice.id}>
                <TableCell>
                  <Link href={tenantRequestsPaths.notice(notice.id)} className="font-medium text-action-on-subtle underline-offset-2 hover:underline">{labels.tenantOf(notice.leaseId, notice.partyId)}</Link>
                </TableCell>
                <TableCell>{labels.referenceOf(notice.leaseId)}</TableCell>
                <TableCell>{reasonLabel(notice.reasonKey)}</TableCell>
                <TableCell>{formatDateFr(notice.requestedDepartureOn)}</TableCell>
                <TableCell>{formatDateFr(notice.createdAt)}</TableCell>
                <TableCell>
                  <span className="flex flex-wrap gap-1">
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                    {isLate(notice) ? <Badge tone="danger">En retard</Badge> : null}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <CursorPager pages={pages} nextCursor={notices.data.nextCursor} label="Pagination des demandes de congé" />
    </>
  );
}
