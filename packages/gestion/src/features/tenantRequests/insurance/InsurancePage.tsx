'use client';

import { Badge, Card, IconButton, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { BellRing, Check, Eye, X } from 'lucide-react';
import { useState } from 'react';
import { CursorPager, useCursorPages } from '../../finances/rent/CursorPager';
import { ListLoading, LoadError, NoRows, PageHeader, useNotify } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';
import { RoleGate, canManage } from '../shared/access';
import { useLeaseLabels } from '../shared/hooks';
import { ConfirmAction } from '../shared/parts/ConfirmAction';
import { AttestationDialog } from './AttestationDialog';
import { RejectDialog } from './RejectDialog';
import { RemindConfirm } from './RemindConfirm';
import { useAcceptInsurance, useInsuranceSubmissions } from './hooks';
import { INSURANCE_STATUSES, insuranceStatusBadge, rejectionReasonLabel } from './model';
import type { InsuranceQuery, InsuranceSubmission } from './model';

const ALL = '';
const CRUMBS = [{ label: 'Suivi' }, { label: 'Conformité', href: '/conformite' }, { label: 'Assurances des locataires' }];

export function InsurancePage() {
  return (
    <RoleGate allowed={canManage} title="Assurances des locataires" crumbs={CRUMBS} message="Les attestations d’assurance déposées par les locataires sont réservées au propriétaire, à l’administrateur et au gestionnaire de l’organisation.">
      <InsuranceContent />
    </RoleGate>
  );
}

function InsuranceContent() {
  const pages = useCursorPages();
  const [status, setStatus] = useState(ALL);
  const query: InsuranceQuery = { cursor: pages.cursor, status: INSURANCE_STATUSES.find((value) => value === status) ?? null };
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, ...CRUMBS]}
        title="Assurances des locataires"
        subtitle="Vérifiez chaque attestation déposée : une acceptation crée la pièce de conformité, un refus n’en crée aucune."
      />
      <Card role="region" aria-label="Liste des dépôts d’attestation" className="gap-3">
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Statut"
            placeholder="Tous les statuts"
            options={[{ value: ALL, label: 'Tous les statuts' }, ...INSURANCE_STATUSES.map((value) => ({ value, label: insuranceStatusBadge[value].label }))]}
            value={status}
            onValueChange={(value) => { setStatus(value); pages.reset(); }}
          />
        </div>
        <SubmissionsTable query={query} pages={pages} />
      </Card>
    </>
  );
}

type Pending = { kind: 'view' | 'accept' | 'reject' | 'remind'; submission: InsuranceSubmission } | null;

function SubmissionsTable({ query, pages }: { query: InsuranceQuery; pages: ReturnType<typeof useCursorPages> }) {
  const submissions = useInsuranceSubmissions(query);
  const labels = useLeaseLabels(submissions.data?.items.map((item) => item.leaseId) ?? []);
  const accept = useAcceptInsurance();
  const notify = useNotify();
  const [pending, setPending] = useState<Pending>(null);
  if (submissions.isPending) return <ListLoading label="Chargement des dépôts d’attestation" />;
  if (submissions.isError || submissions.data === undefined) return <LoadError title="Impossible de charger les dépôts d’attestation" />;
  if (submissions.data.items.length === 0) return <NoRows>{query.status === null ? 'Aucun dépôt. Les attestations apparaissent ici quand un locataire en dépose une depuis son espace.' : 'Aucun dépôt ne correspond à ce statut.'}</NoRows>;

  const target = pending?.submission ?? null;
  const targetTenant = target === null ? '' : labels.tenantOf(target.leaseId, target.partyId);
  const close = () => { setPending(null); };

  return (
    <>
      <Table aria-label="Dépôts d’attestation d’assurance">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Locataire</TableHeaderCell>
            <TableHeaderCell>Bail</TableHeaderCell>
            <TableHeaderCell>Assureur</TableHeaderCell>
            <TableHeaderCell>Couverture</TableHeaderCell>
            <TableHeaderCell>Déposée le</TableHeaderCell>
            <TableHeaderCell>Statut</TableHeaderCell>
            <TableHeaderCell>Actions</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {submissions.data.items.map((item) => {
            const badge = insuranceStatusBadge[item.status];
            const tenant = labels.tenantOf(item.leaseId, item.partyId);
            return (
              <TableRow key={item.id}>
                <TableCell>{tenant}</TableCell>
                <TableCell>{labels.referenceOf(item.leaseId)}</TableCell>
                <TableCell>{`${item.insurer}, ${item.policyNumber}`}</TableCell>
                <TableCell>{`${formatDateFr(item.startsOn)} au ${formatDateFr(item.endsOn)}`}</TableCell>
                <TableCell>{formatDateFr(item.createdAt)}</TableCell>
                <TableCell>
                  <span className="flex flex-col items-start gap-1">
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                    {item.rejectionReason === null ? null : <span className="text-caption text-fg-subtle">{rejectionReasonLabel[item.rejectionReason]}</span>}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1">
                    <IconButton label={`Voir l’attestation de ${tenant}`} icon={Eye} onClick={() => { setPending({ kind: 'view', submission: item }); }} />
                    {item.status === 'pending' ? (
                      <>
                        <IconButton label={`Accepter l’attestation de ${tenant}`} icon={Check} onClick={() => { setPending({ kind: 'accept', submission: item }); }} />
                        <IconButton label={`Refuser l’attestation de ${tenant}`} icon={X} variant="danger" onClick={() => { setPending({ kind: 'reject', submission: item }); }} />
                      </>
                    ) : null}
                    {item.status === 'rejected' || item.status === 'withdrawn' ? (
                      <IconButton label={`Relancer le bail de ${tenant}`} icon={BellRing} onClick={() => { setPending({ kind: 'remind', submission: item }); }} />
                    ) : null}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <CursorPager pages={pages} nextCursor={submissions.data.nextCursor} label="Pagination des dépôts d’attestation" />
      <AttestationDialog submission={pending?.kind === 'view' ? target : null} tenant={targetTenant} onClose={close} />
      <RejectDialog submission={pending?.kind === 'reject' ? target : null} tenant={targetTenant} onClose={close} />
      <ConfirmAction
        open={pending?.kind === 'accept'}
        title="Accepter cette attestation ?"
        description={`Une pièce de conformité « assurance habitation » est créée pour le bail ${target === null ? '' : labels.referenceOf(target.leaseId)} dans la même opération, avec les dates déposées.`}
        confirmLabel="Accepter l’attestation"
        failureTitle="Attestation non acceptée"
        run={async () => {
          if (target === null) return;
          await accept.mutateAsync(target.id);
          notify({ title: 'Attestation acceptée', description: 'La pièce de conformité est créée et la couverture du bail est à jour.' });
        }}
        onClose={close}
      />
      <RemindConfirm leaseId={target?.leaseId ?? ''} open={pending?.kind === 'remind'} onClose={close} />
    </>
  );
}
