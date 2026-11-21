'use client';

import { Alert, Button, Icon } from '@eguardimmo/ui';
import { FileText, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DownloadButton } from '@/components/DownloadButton';
import { FailureAlert } from '@/components/FailureAlert';
import { KeyValueList } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import { useFlash } from '@/components/flash';
import { formatDate, formatDateTime } from '@/lib/dates';
import { describeFailure } from '@/tenant/errors';
import { CLOSED_OUTCOME_LABEL, NOTICE_STATUS_VIEW, NOTICE_WORDING } from '@/tenant/noticeLabels';
import { useLetterDownload, useWithdrawNotice } from '@/tenant/noticeQueries';
import type { NoticeRequest } from '@/tenant/noticeSchemas';
import { safeFileName } from '@/tenant/download';

export function NoticeRequestCard({ item, reasonLabel }: { item: NoticeRequest; reasonLabel: string }) {
  const withdraw = useWithdrawNotice();
  const letter = useLetterDownload();
  const show = useFlash((state) => state.show);
  const [confirming, setConfirming] = useState(false);
  const status = NOTICE_STATUS_VIEW[item.status];
  const confirm = () => {
    withdraw.mutate(item.id, {
      onSuccess: () => {
        setConfirming(false);
        show({ tone: 'success', title: 'Demande retirée', detail: 'Votre demande de congé a été retirée.', path: '/bail/conge' });
      },
    });
  };
  const items = [
    { label: 'Transmise le', value: formatDateTime(item.createdAt) },
    { label: 'Motif', value: reasonLabel },
    {
      label: item.departureIsIndicative ? 'Départ (indicatif)' : 'Départ',
      value: formatDate(item.requestedDepartureOn),
    },
    ...(item.receivedOn === null ? [] : [{ label: 'Réception actée', value: formatDate(item.receivedOn) }]),
    ...(item.acknowledgedAt === null ? [] : [{ label: 'Accusé le', value: formatDateTime(item.acknowledgedAt) }]),
    ...(item.forwardingAddress === null ? [] : [{ label: 'Réexpédition', value: item.forwardingAddress }]),
    { label: 'Justificatif', value: item.hasProof ? 'Joint à la demande' : 'Aucun' },
  ];
  return (
    <div className="flex flex-col gap-2 border-t border-line py-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        <span className="flex flex-wrap items-center gap-1.5">
          {item.hasLetter ? (
            <DownloadButton
              label="Télécharger la lettre de congé"
              pending={letter.isPending}
              onDownload={() => { letter.mutate({ id: item.id, filename: safeFileName(`Conge-${item.requestedDepartureOn}.pdf`) }); }}
            />
          ) : null}
          {item.status === 'submitted' ? (
            <Button size="sm" variant="secondary" onClick={() => { setConfirming(true); }}>
              <Icon icon={Undo2} />
              Retirer ma demande
            </Button>
          ) : null}
        </span>
      </div>
      {item.status === 'submitted' && item.acknowledgementOverdue ? (
        <Alert tone="warning" title="L’agence n’a pas encore accusé réception">
          <span className="flex items-start gap-1.5">
            <Icon icon={FileText} size={16} className="mt-0.5 shrink-0" />
            Un simple message ne vaut pas congé. Téléchargez la lettre et envoyez-la par lettre recommandée avec avis de réception.
          </span>
        </Alert>
      ) : null}
      {item.status === 'closed' && item.closedOutcome !== null ? <p className="text-body text-fg-muted">{CLOSED_OUTCOME_LABEL[item.closedOutcome]}</p> : null}
      <KeyValueList labelWidth="8rem" items={items} />
      {letter.isError ? <FailureAlert title="La lettre n’a pas pu être téléchargée" error={letter.error} wording={NOTICE_WORDING} /> : null}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Retirer votre demande de congé ?"
        description="Votre agence ne tiendra plus compte de cette demande. Tant qu’elle n’a pas accusé réception, vous pouvez la retirer, puis en faire une nouvelle."
        confirmLabel="Retirer ma demande"
        loading={withdraw.isPending}
        onConfirm={confirm}
        error={withdraw.isError ? describeFailure(withdraw.error, NOTICE_WORDING).message : undefined}
      />
    </div>
  );
}
