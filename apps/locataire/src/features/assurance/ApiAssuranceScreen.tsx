'use client';

import { Alert, Button, Icon, StatCard } from '@eguardimmo/ui';
import { Trash2, Upload } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DownloadButton } from '@/components/DownloadButton';
import { FailureAlert } from '@/components/FailureAlert';
import { LeaseGate } from '@/components/LeaseGate';
import { PageHeader } from '@/components/PageHeader';
import { Skeleton } from '@/components/ScreenState';
import { EmptyLine, KeyValueList, ListRow, SectionCard } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import { useFlash } from '@/components/flash';
import { formatDate } from '@/lib/dates';
import { describeFailure } from '@/tenant/errors';
import { useFileDownload } from '@/tenant/documentQueries';
import { COVERAGE_VIEW, INSURANCE_WORDING, REJECTION_LABEL, SUBMISSION_VIEW } from '@/tenant/insuranceLabels';
import { useInsurance, useWithdrawSubmission } from '@/tenant/insuranceQueries';
import { submissionFilePath } from '@/tenant/insuranceRequests';
import type { InsuranceSubmission } from '@/tenant/insuranceSchemas';
import { safeFileName } from '@/tenant/download';
import type { LeaseSummary } from '@/tenant/model';
import { useSelectedLease } from '@/tenant/selectedLease';

export function ApiAssuranceScreen() {
  const selection = useSelectedLease();
  const lease = selection.lease;
  const canDeposit = lease !== null && !lease.inGrace;
  return (
    <>
      <PageHeader
        title="Assurance habitation"
        crumbs={[{ label: 'Échanges' }, { label: 'Assurance' }]}
        subtitle="L’état de la couverture de votre bail et les attestations que vous avez déposées."
        actions={
          canDeposit ? (
            <Button asChild>
              <Link href={`/assurance/deposer?bail=${lease.id}`}>
                <Icon icon={Upload} />
                Déposer une attestation
              </Link>
            </Button>
          ) : undefined
        }
      />
      <LeaseGate selection={selection} errorTitle="Vos baux n’ont pas pu être chargés">
        {(current) => <InsuranceContent key={current.id} lease={current} />}
      </LeaseGate>
    </>
  );
}

function InsuranceContent({ lease }: { lease: LeaseSummary }) {
  const insurance = useInsurance(lease.id);
  if (insurance.data === undefined) {
    return insurance.isError ? (
      <FailureAlert title="Votre assurance n’a pas pu être chargée" error={insurance.error} wording={INSURANCE_WORDING} onRetry={() => void insurance.refetch()} />
    ) : (
      <Skeleton rows={2} />
    );
  }
  const { coverage, submissions } = insurance.data;
  const view = COVERAGE_VIEW[coverage.state];
  const pending = submissions.some((item) => item.status === 'pending');
  return (
    <>
      {lease.inGrace ? (
        <Alert tone="warning" title="Bail terminé : dépôt impossible">
          Votre accès au bail est en lecture seule : vous ne pouvez plus déposer d’attestation.
        </Alert>
      ) : null}
      {coverage.state === 'missing' && !lease.inGrace ? (
        <Alert tone="danger" title="Aucune attestation valide">
          Votre bail exige une assurance habitation : déposez une attestation en cours de validité. L’agence la vérifie avant de la retenir.
        </Alert>
      ) : null}
      {coverage.state === 'expiring' ? (
        <Alert tone="warning" title="Attestation à renouveler">
          Votre couverture se termine{coverage.endsOn === null ? ' bientôt' : ` le ${formatDate(coverage.endsOn)}`}. Déposez la nouvelle attestation dès que votre assureur l’a émise.
        </Alert>
      ) : null}
      {pending && !lease.inGrace ? (
        <Alert tone="info" title="Dépôt en attente de vérification">
          Votre agence n’a pas encore traité votre dernier dépôt. Vous pouvez le retirer pour en déposer un autre.
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard label="Couverture du bail" value={view.label}>
          <StatusBadge tone={view.tone}>{view.label}</StatusBadge>
        </StatCard>
        <StatCard label="Fin de couverture" value={coverage.endsOn === null ? '—' : formatDate(coverage.endsOn)}>
          <span className="text-caption text-fg-subtle">Uniquement les attestations acceptées par l’agence</span>
        </StatCard>
      </div>
      <SectionCard id="as-depots" title="Mes attestations déposées">
        {submissions.length === 0 ? (
          <EmptyLine>Vous n’avez déposé aucune attestation pour ce bail.</EmptyLine>
        ) : (
          <ul>
            {submissions.map((item) => (
              <SubmissionRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}

function SubmissionRow({ item }: { item: InsuranceSubmission }) {
  const download = useFileDownload();
  const withdraw = useWithdrawSubmission();
  const show = useFlash((state) => state.show);
  const [confirming, setConfirming] = useState(false);
  const status = SUBMISSION_VIEW[item.status];
  const title = `${item.insurer} · contrat ${item.policyNumber}`;
  const confirm = () => {
    withdraw.mutate(item.id, {
      onSuccess: () => {
        setConfirming(false);
        show({ tone: 'success', title: 'Dépôt retiré', detail: 'Vous pouvez déposer une nouvelle attestation.', path: '/assurance' });
      },
    });
  };
  return (
    <>
      <ListRow
        title={title}
        detail={`Du ${formatDate(item.startsOn)} au ${formatDate(item.endsOn)} · déposée le ${formatDate(item.createdAt)}`}
        trailing={
          <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            <span className="flex items-center gap-1">
              <DownloadButton
                label={`Télécharger l’attestation ${title}`}
                pending={download.isPending}
                onDownload={() => { download.mutate({ path: submissionFilePath(item.id), filename: safeFileName(`Attestation-${item.insurer}-${item.startsOn}`) }); }}
              />
              {item.status === 'pending' ? (
                <Button size="sm" variant="ghost" aria-label={`Retirer le dépôt ${title}`} onClick={() => { setConfirming(true); }}>
                  <Icon icon={Trash2} />
                  Retirer
                </Button>
              ) : null}
            </span>
          </span>
        }
      />
      {item.status === 'rejected' ? (
        <li className="pb-2">
          <Alert tone="danger" title="Attestation refusée">
            <KeyValueList
              labelWidth="5rem"
              items={[
                { label: 'Motif', value: item.rejectionReason === null ? 'Non précisé.' : REJECTION_LABEL[item.rejectionReason] },
                ...(item.note === null ? [] : [{ label: 'Précision', value: item.note }]),
              ]}
            />
          </Alert>
        </li>
      ) : null}
      {download.isError ? (
        <li className="pb-2">
          <FailureAlert title="Le téléchargement a échoué" error={download.error} wording={INSURANCE_WORDING} />
        </li>
      ) : null}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Retirer ce dépôt ?"
        description={`L’attestation ${title} ne sera plus examinée par votre agence. Vous pourrez en déposer une autre.`}
        confirmLabel="Retirer le dépôt"
        loading={withdraw.isPending}
        onConfirm={confirm}
        error={withdraw.isError ? describeFailure(withdraw.error, INSURANCE_WORDING).message : undefined}
      />
    </>
  );
}
