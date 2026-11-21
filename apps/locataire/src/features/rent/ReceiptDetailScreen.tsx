'use client';

import { Alert, Button, StatCard } from '@eguardimmo/ui';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { KeyValueList, SectionCard } from '@/components/Section';
import { formatDate } from '@/lib/dates';
import { NOT_AVAILABLE, formatApiMoney } from '@/tenant/format';
import type { Receipt } from '@/tenant/rentModel';
import { leaseName, periodRange } from '@/tenant/rentLabels';
import { usePdfDownload, useReceipt } from '@/tenant/rentQueries';
import { AmountsList } from './AmountsList';
import { DetailState } from './NotFound';
import { DownloadFailure, PdfTextButton, receiptRequest } from './PdfButton';
import { ReceiptStatus } from './ReceiptStatus';

export function ReceiptDetailScreen({ id }: { id: string }) {
  const receipt = useReceipt(id);
  return (
    <DetailState
      query={receipt}
      notFound={{ title: 'Quittance introuvable', backHref: '/loyers/quittances', backLabel: 'Retour à mes quittances' }}
      failureTitle="Cette quittance n’a pas pu être chargée"
    >
      {(data) => <ReceiptContent receipt={data} />}
    </DetailState>
  );
}

function ReceiptContent({ receipt }: { receipt: Receipt }) {
  const downloads = usePdfDownload();
  const unit = receipt.unit;
  return (
    <>
      <PageHeader
        title={`Quittance ${receipt.number}`}
        crumbs={[{ label: 'Mes quittances', href: '/loyers/quittances' }, { label: receipt.number }]}
        badge={<ReceiptStatus isVoid={receipt.isVoid} />}
        subtitle={`Bail ${leaseName(receipt.lease)} · émise le ${formatDate(receipt.issuedOn)}`}
        actions={
          <>
            {receipt.isVoid ? null : (
              <PdfTextButton downloads={downloads} request={receiptRequest(receipt)}>
                Télécharger la quittance (PDF)
              </PdfTextButton>
            )}
            {receipt.installmentId === null ? null : (
              <Button variant="secondary" asChild>
                <Link href={`/loyers/echeances/${receipt.installmentId}`}>Voir l’échéance</Link>
              </Button>
            )}
            <Button variant="secondary" asChild>
              <Link href={`/bail/${receipt.lease.id}`}>Voir le bail</Link>
            </Button>
          </>
        }
      />
      {receipt.isVoid ? (
        <Alert tone="warning" title="Quittance annulée">
          {receipt.voidedAt === null ? 'Cette quittance a été annulée.' : `Cette quittance a été annulée le ${formatDate(receipt.voidedAt)}.`} Elle ne peut plus être téléchargée et ne prouve plus un paiement.
        </Alert>
      ) : null}
      <DownloadFailure downloads={downloads} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Montant" value={formatApiMoney(receipt.amounts.total)} />
        <StatCard label="Payée le" value={receipt.paidOn === null ? NOT_AVAILABLE : formatDate(receipt.paidOn)} />
        <StatCard label="Émise le" value={formatDate(receipt.issuedOn)} />
      </div>
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        <SectionCard id="quittance-informations" title="Informations">
          <KeyValueList
            labelWidth="7rem"
            items={[
              { label: 'Émetteur', value: receipt.issuer ?? NOT_AVAILABLE },
              { label: 'Locataires', value: receipt.tenants.length === 0 ? NOT_AVAILABLE : receipt.tenants.join(', ') },
              {
                label: 'Logement',
                value: unit === null ? NOT_AVAILABLE : [unit.reference, unit.propertyName, unit.address].filter((part): part is string => part !== null).join(' · '),
              },
              {
                label: 'Période',
                value: receipt.periodStart === null || receipt.periodEnd === null ? NOT_AVAILABLE : periodRange(receipt.periodStart, receipt.periodEnd),
              },
            ]}
          />
        </SectionCard>
        <SectionCard id="quittance-montants" title="Montants">
          <AmountsList amounts={receipt.amounts} />
        </SectionCard>
      </div>
    </>
  );
}
