'use client';

import { Badge, Card, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { Plus } from 'lucide-react';
import { CursorPager, useCursorPages } from '../../finances/rent/CursorPager';
import { LinkButton, ListLoading, LoadError, NoRows, PageHeader, useGestionNavigation } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';
import { RoleGate, canManage } from '../shared/access';
import { useLeaseSearch } from '../shared/hooks';
import { tenantRequestsPaths } from '../shared/paths';
import { useInspections } from './hooks';
import { kindShort, performerLabel, publicationBadge } from './model';

const CRUMBS = [{ label: 'Baux', href: '/baux' }, { label: 'États des lieux' }];

export function InspectionsPage() {
  return (
    <RoleGate allowed={canManage} title="États des lieux" crumbs={CRUMBS} message="Les états des lieux sont réservés au propriétaire, à l’administrateur et au gestionnaire de l’organisation.">
      <InspectionsContent />
    </RoleGate>
  );
}

function InspectionsContent() {
  const { search, push } = useGestionNavigation();
  const leaseId = search.get('bail');
  const leases = useLeaseSearch('');
  const options = (leases.data ?? []).map((lease) => ({
    value: lease.id,
    label: `${lease.reference}${lease.tenants.length > 0 ? ` · ${lease.tenants.map((tenant) => tenant.name).join(', ')}` : ''}`,
  }));

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, ...CRUMBS]}
        title="États des lieux"
        subtitle="Un état des lieux réalisé hors application est enregistré en PDF, puis publié : le locataire le lit, le télécharge et peut y ajouter des remarques."
        actions={leaseId === null ? null : <LinkButton href={tenantRequestsPaths.inspectionNew(leaseId)} variant="primary" icon={Plus}>Nouvel état des lieux</LinkButton>}
      />
      <Card role="region" aria-label="États des lieux du bail" className="gap-3">
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Select
            label="Bail"
            placeholder="Choisir un bail, ex. : BL-2026-0042"
            options={options}
            value={leaseId ?? ''}
            searchable
            searchPlaceholder="Rechercher un bail ou un locataire"
            emptyLabel="Aucun bail trouvé"
            onValueChange={(value) => { push(tenantRequestsPaths.inspectionsOf(value)); }}
          />
        </div>
        {leaseId === null ? <NoRows>Choisissez un bail pour voir ses états des lieux.</NoRows> : <InspectionsTable key={leaseId} leaseId={leaseId} />}
      </Card>
    </>
  );
}

function InspectionsTable({ leaseId }: { leaseId: string }) {
  const { Link } = useGestionNavigation();
  const pages = useCursorPages();
  const inspections = useInspections(leaseId, pages.cursor);
  if (inspections.isPending) return <ListLoading label="Chargement des états des lieux" />;
  if (inspections.isError || inspections.data === undefined) return <LoadError title="Impossible de charger les états des lieux" />;
  if (inspections.data.items.length === 0) return <NoRows>Aucun état des lieux pour ce bail. Enregistrez celui d’entrée dès la remise des clés.</NoRows>;

  return (
    <>
      <Table aria-label="États des lieux du bail">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Type</TableHeaderCell>
            <TableHeaderCell>Réalisé le</TableHeaderCell>
            <TableHeaderCell>Réalisé par</TableHeaderCell>
            <TableHeaderCell>Signataires</TableHeaderCell>
            <TableHeaderCell>Statut</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {inspections.data.items.map((inspection) => {
            const badge = publicationBadge(inspection);
            return (
              <TableRow key={inspection.id}>
                <TableCell>
                  <Link href={tenantRequestsPaths.inspection(inspection.id)} className="font-medium text-action-on-subtle underline-offset-2 hover:underline">{kindShort[inspection.kind]}</Link>
                </TableCell>
                <TableCell>{formatDateFr(inspection.performedOn)}</TableCell>
                <TableCell>{performerLabel[inspection.performedBy]}</TableCell>
                <TableCell>{String(inspection.signatories.length)}</TableCell>
                <TableCell><Badge tone={badge.tone}>{badge.label}</Badge></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <CursorPager pages={pages} nextCursor={inspections.data.nextCursor} label="Pagination des états des lieux" />
    </>
  );
}
