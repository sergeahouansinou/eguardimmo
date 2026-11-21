'use client';

import { Button, Icon, StatCard } from '@eguardimmo/ui';
import { ReceiptText } from 'lucide-react';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { EmptyLine, KeyValueList, SectionCard } from '@/components/Section';
import { formatDate } from '@/lib/dates';
import { NOT_AVAILABLE, formatApiMoney, formatBasisPoints } from '@/tenant/format';
import type { Installment } from '@/tenant/rentModel';
import { leaseName, periodRange, periodTitle } from '@/tenant/rentLabels';
import { useInstallment, usePdfDownload } from '@/tenant/rentQueries';
import { AmountsList } from './AmountsList';
import { DetailState } from './NotFound';
import { DownloadFailure, PdfTextButton, noticeRequest } from './PdfButton';
import { StatusCell } from './StatusCell';

export function InstallmentDetailScreen({ id }: { id: string }) {
  const installment = useInstallment(id);
  return (
    <DetailState
      query={installment}
      notFound={{ title: 'Échéance introuvable', backHref: '/loyers', backLabel: 'Retour à mes loyers' }}
      failureTitle="Cette échéance n’a pas pu être chargée"
    >
      {(data) => <InstallmentContent installment={data} />}
    </DetailState>
  );
}

function InstallmentContent({ installment }: { installment: Installment }) {
  const downloads = usePdfDownload();
  const title = periodTitle(installment.periodStart);
  const notice = installment.notice;
  return (
    <>
      <PageHeader
        title={`Loyer ${title}`}
        crumbs={[{ label: 'Mes loyers', href: '/loyers' }, { label: title }]}
        badge={<StatusCell item={installment} />}
        subtitle={`Bail ${leaseName(installment.lease)} · ${periodRange(installment.periodStart, installment.periodEnd)}`}
        actions={
          <>
            {installment.outstanding !== null && installment.outstanding.amount > 0 ? (
              <Button asChild>
                <Link href={`/loyers/payer?bail=${installment.lease.id}&echeance=${installment.id}`}>Payer cette échéance</Link>
              </Button>
            ) : null}
            {notice === null ? null : (
              <PdfTextButton downloads={downloads} request={noticeRequest({ id: installment.id, notice })}>
                Télécharger l’avis (PDF)
              </PdfTextButton>
            )}
            <Button variant="secondary" asChild>
              <Link href={`/bail/${installment.lease.id}`}>Voir le bail</Link>
            </Button>
          </>
        }
      />
      <DownloadFailure downloads={downloads} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Montant appelé" value={formatApiMoney(installment.amounts.total)} />
        <StatCard
          label="Reste dû"
          value={installment.outstanding === null ? NOT_AVAILABLE : formatApiMoney(installment.outstanding)}
          tone={installment.isOverdue ? 'danger' : 'default'}
        >
          <span className="text-caption text-fg-subtle">Au grand livre de votre agence</span>
        </StatCard>
        <StatCard label="À payer avant le" value={formatDate(installment.dueOn)} />
      </div>
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        <SectionCard id="echeance-montants" title="Montants">
          <AmountsList amounts={installment.amounts} />
        </SectionCard>
        <SectionCard id="echeance-documents" title="Avis et quittance">
          <KeyValueList
            labelWidth="7rem"
            items={[
              {
                label: 'Avis d’échéance',
                value: notice === null ? 'Pas encore disponible' : `${notice.number}, émis le ${formatDate(notice.issuedOn)}`,
              },
              {
                label: 'Quittance',
                value:
                  installment.receipt === null ? (
                    'Émise quand l’échéance est soldée'
                  ) : (
                    <Link href={`/loyers/quittances/${installment.receipt.id}`} className="inline-flex items-center gap-1.5 text-action hover:underline">
                      <Icon icon={ReceiptText} size={14} />
                      {`${installment.receipt.number}, émise le ${formatDate(installment.receipt.issuedOn)}`}
                    </Link>
                  ),
              },
            ]}
          />
          <div className="pt-2">
            <Button variant="link" size="sm" asChild>
              <Link href={`/loyers/paiements?bail=${installment.lease.id}`}>Voir les paiements de ce bail</Link>
            </Button>
          </div>
        </SectionCard>
      </div>
      {installment.lines === null ? null : (
        <SectionCard id="echeance-lignes" title="Détail de l’échéance">
          {installment.lines.length === 0 ? (
            <EmptyLine>Aucune ligne de détail pour cette échéance.</EmptyLine>
          ) : (
            <DataTable
              label="Lignes de l’échéance"
              rows={installment.lines}
              rowKey={(line) => `${line.label}-${line.from}`}
              columns={[
                { id: 'libelle', header: 'Libellé', primary: true, cell: (line) => line.label },
                {
                  id: 'periode',
                  header: 'Période',
                  cell: (line) => `${periodRange(line.from, line.to)} (${String(line.days)}/${String(line.monthDays)} j)`,
                },
                { id: 'tva', header: 'TVA', numeric: true, cell: (line) => formatBasisPoints(line.vatBasisPoints) },
                { id: 'montant', header: 'Montant', numeric: true, cell: (line) => formatApiMoney(line.amount) },
              ]}
            />
          )}
        </SectionCard>
      )}
    </>
  );
}
