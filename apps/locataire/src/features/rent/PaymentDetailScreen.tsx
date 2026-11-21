'use client';

import { Alert, Button, StatCard } from '@eguardimmo/ui';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { EmptyLine, KeyValueList, ListRow, SectionCard } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate } from '@/lib/dates';
import { formatApiMoney } from '@/tenant/format';
import type { Payment } from '@/tenant/rentModel';
import { PAYMENT_STATUS_VIEW, leaseName, paymentMethodName } from '@/tenant/rentLabels';
import { usePayment } from '@/tenant/rentQueries';
import { DetailState } from './NotFound';

export function PaymentDetailScreen({ id }: { id: string }) {
  const payment = usePayment(id);
  return (
    <DetailState
      query={payment}
      notFound={{ title: 'Paiement introuvable', backHref: '/loyers/paiements', backLabel: 'Retour à mes paiements' }}
      failureTitle="Ce paiement n’a pas pu être chargé"
    >
      {(data) => <PaymentContent payment={data} />}
    </DetailState>
  );
}

function PaymentContent({ payment }: { payment: Payment }) {
  const status = PAYMENT_STATUS_VIEW[payment.status];
  const date = formatDate(payment.receivedOn);
  return (
    <>
      <PageHeader
        title={`Paiement du ${date}`}
        crumbs={[{ label: 'Mes paiements', href: '/loyers/paiements' }, { label: date }]}
        badge={<StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
        subtitle={`Bail ${leaseName(payment.lease)}`}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href={`/loyers?bail=${payment.lease.id}`}>Voir les loyers du bail</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={`/bail/${payment.lease.id}`}>Voir le bail</Link>
            </Button>
          </>
        }
      />
      {payment.status === 'cancelled' ? (
        <Alert tone="warning" title="Paiement annulé">
          {payment.cancelledOn === null ? 'Ce paiement a été annulé.' : `Ce paiement a été annulé le ${formatDate(payment.cancelledOn)}.`} Il ne compte plus dans vos échéances.
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Montant" value={formatApiMoney(payment.amount)} />
        <StatCard label="Reçu le" value={date} />
        <StatCard label="Mode de paiement" value={paymentMethodName(payment.method)} />
      </div>
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        <SectionCard id="paiement-informations" title="Informations">
          <KeyValueList
            labelWidth="7rem"
            items={[
              { label: 'Statut', value: status.label },
              { label: 'Bail', value: leaseName(payment.lease) },
              ...(payment.cancelledOn === null ? [] : [{ label: 'Annulé le', value: formatDate(payment.cancelledOn) }]),
            ]}
          />
        </SectionCard>
        {payment.allocations === null ? null : (
          <SectionCard id="paiement-repartition" title="Répartition sur vos échéances">
            {payment.allocations.length === 0 ? (
              <EmptyLine>
                {payment.status === 'cancelled' ? 'Ce paiement annulé n’est plus réparti.' : 'Ce paiement n’est réparti sur aucune échéance pour le moment.'}
              </EmptyLine>
            ) : (
              <ul>
                {payment.allocations.map((allocation) => (
                  <ListRow
                    key={allocation.installmentId}
                    title="Échéance de loyer"
                    href={`/loyers/echeances/${allocation.installmentId}`}
                    trailing={<span className="tabular-nums text-body-strong">{formatApiMoney(allocation.amount)}</span>}
                  />
                ))}
              </ul>
            )}
          </SectionCard>
        )}
      </div>
    </>
  );
}
