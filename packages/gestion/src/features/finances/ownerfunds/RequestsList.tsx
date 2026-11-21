'use client';

import { Badge, Button, EmptyState, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Landmark } from 'lucide-react';
import { useState } from 'react';
import { ApproveRequestDialog } from './ApproveRequestDialog';
import type { ApproveTarget } from './ApproveRequestDialog';
import { OWNER_FUNDS_ROOT, useOwnerFundsPermissions, usePartyNames, usePayoutRequests } from './hooks';
import { requestBadge } from './labels';
import type { PayoutAccountRequest, PayoutRequestStatus } from './model';
import { ActionError, ReasonDialog } from './parts';
import { useOwnerFundsSource } from './source';
import { CursorPager, useCursorPages } from '../rent/CursorPager';
import { saveBlob } from '../rent/download';
import { ListLoading, LoadError, useNotify } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { useTwoFactorProof } from '../../reauth';

const EMPTY: Record<PayoutRequestStatus, string> = {
  pending: 'Aucune demande à valider pour le moment.',
  awaiting_code: 'Aucune demande n’attend le code e-mail du propriétaire.',
  approved: 'Aucune demande approuvée.',
  rejected: 'Aucune demande refusée.',
  withdrawn: 'Aucune demande retirée par son propriétaire.',
  expired: 'Aucune demande expirée.',
};

export function RequestsList({ status, mandantId }: { status: PayoutRequestStatus; mandantId: string | undefined }) {
  const source = useOwnerFundsSource();
  const permissions = useOwnerFundsPermissions();
  const client = useQueryClient();
  const notify = useNotify();
  const proof = useTwoFactorProof(source.confirmTwoFactor);
  const pages = useCursorPages();
  const requests = usePayoutRequests({ cursor: pages.cursor, status, mandantId });
  const rows = requests.data?.items ?? [];
  const names = usePartyNames(rows.map((row) => row.mandantId));
  const [approving, setApproving] = useState<ApproveTarget | null>(null);
  const [rejecting, setRejecting] = useState<ApproveTarget | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const download = async (request: PayoutAccountRequest): Promise<void> => {
    setFailure(null);
    setDownloading(request.id);
    try {
      const file = await source.payoutProof(request.id);
      saveBlob(file.blob, `justificatif-rib-${request.id.slice(0, 8)}.${file.extension}`);
    } catch (error) {
      if (proof.intercept(error, () => { void download(request); }, () => { setFailure(error); })) return;
      setFailure(error);
    } finally {
      setDownloading(null);
    }
  };

  const reject = async (target: ApproveTarget, reason: string): Promise<void> => {
    const outcome = await new Promise<{ error: unknown } | null>((settle) => {
      const attempt = (): void => {
        source.rejectPayoutRequest(target.request.id, target.request.lockVersion, reason).then(
          () => {
            void client.invalidateQueries({ queryKey: OWNER_FUNDS_ROOT });
            notify({ title: 'Demande refusée', description: `${target.name} : le compte de paiement actuel reste en vigueur.` });
            settle(null);
          },
          (error: unknown) => {
            if (proof.intercept(error, attempt, () => { settle({ error }); })) return;
            void client.invalidateQueries({ queryKey: OWNER_FUNDS_ROOT });
            settle({ error });
          },
        );
      };
      attempt();
    });
    if (outcome !== null) throw outcome.error;
  };

  return (
    <>
      {failure === null ? null : <ActionError title="Pièce non téléchargée" error={failure} />}
      {requests.isError ? <LoadError title={requests.error?.message ?? 'Les demandes n’ont pas pu être chargées'} /> : null}
      {requests.isPending && !requests.isError ? <ListLoading label="Chargement des demandes de changement d’IBAN" /> : null}
      {requests.data && rows.length === 0 ? <EmptyState icon={Landmark} title={EMPTY[status]} description="Une demande apparaît ici quand un propriétaire propose un nouvel IBAN depuis son espace." /> : null}
      {rows.length > 0 ? (
        <Table aria-label="Demandes de changement d’IBAN">
          <TableHead>
            <TableRow>
              <TableHeaderCell>Mandant</TableHeaderCell>
              <TableHeaderCell>Compte demandé</TableHeaderCell>
              <TableHeaderCell>Titulaire déclaré</TableHeaderCell>
              <TableHeaderCell>État</TableHeaderCell>
              <TableHeaderCell>Déposée le</TableHeaderCell>
              <TableHeaderCell>Décision</TableHeaderCell>
              {permissions.sensitive ? <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell> : null}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((request) => (
              <TableRow key={request.id}>
                <TableCell strong>{names(request.mandantId)}</TableCell>
                <TableCell>{request.bankLast4 === null ? '—' : `IBAN •••• ${request.bankLast4}`}</TableCell>
                <TableCell>{request.holderName ?? '—'}</TableCell>
                <TableCell><Badge tone={requestBadge[request.status].tone}>{requestBadge[request.status].label}</Badge></TableCell>
                <TableCell>{request.requestedAt ? formatDateFr(request.requestedAt) : '—'}</TableCell>
                <TableCell>{decisionText(request)}</TableCell>
                {permissions.sensitive ? (
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      {request.hasProof ? (
                        <Button variant="ghost" size="sm" loading={downloading === request.id} onClick={() => { void download(request); }}>
                          Pièce du RIB{' '}<span className="sr-only">{`de ${names(request.mandantId)}`}</span>
                        </Button>
                      ) : null}
                      {request.status === 'pending' ? (
                        <>
                          <Button size="sm" onClick={() => { setApproving({ request, name: names(request.mandantId) }); }}>
                            Approuver{' '}<span className="sr-only">{`la demande de ${names(request.mandantId)}`}</span>
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setRejecting({ request, name: names(request.mandantId) }); }}>
                            Refuser{' '}<span className="sr-only">{`la demande de ${names(request.mandantId)}`}</span>
                          </Button>
                        </>
                      ) : null}
                    </span>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
      <CursorPager pages={pages} nextCursor={requests.data?.nextCursor ?? null} label="Pagination des demandes" />
      <ApproveRequestDialog target={approving} proof={proof} onClose={() => { setApproving(null); }} />
      <ReasonDialog
        open={rejecting !== null}
        title="Refuser le changement d’IBAN"
        description={rejecting ? `La demande de ${rejecting.name} est refusée : son compte de paiement actuel reste en vigueur.` : ''}
        confirmLabel="Refuser la demande"
        failureTitle="Demande non refusée"
        placeholder="Ex. titulaire de la pièce différent du mandant"
        run={(reason) => (rejecting ? reject(rejecting, reason) : Promise.resolve())}
        onClose={() => { setRejecting(null); }}
      />
      {proof.dialog}
    </>
  );
}

function decisionText(request: PayoutAccountRequest): string {
  if (request.status === 'rejected') return `${request.decidedAt ? `Le ${formatDateFr(request.decidedAt)}. ` : ''}${request.rejectReason ?? ''}`.trim() || '—';
  if (request.status === 'approved') return request.decidedAt ? `Le ${formatDateFr(request.decidedAt)}` : '—';
  return '—';
}
