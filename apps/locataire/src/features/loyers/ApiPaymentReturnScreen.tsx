'use client';

import { Alert, Button, Card } from '@eguardimmo/ui';
import { CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FailureAlert } from '@/components/FailureAlert';
import { PageHeader } from '@/components/PageHeader';
import { Skeleton } from '@/components/ScreenState';
import { KeyValueList } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import { useFlash } from '@/components/flash';
import { formatDateTime } from '@/lib/dates';
import { describeFailure } from '@/tenant/errors';
import { formatApiMoney } from '@/tenant/format';
import { FAILURE_LABEL, ONLINE_METHOD_LABEL, ONLINE_PAYMENT_WORDING, ONLINE_STATUS_VIEW } from '@/tenant/onlinePaymentLabels';
import { useCancelOnlinePayment, useOnlinePayment } from '@/tenant/onlinePaymentQueries';
import { isLive, safeRedirect } from '@/tenant/onlinePaymentSchemas';
import type { OnlinePayment } from '@/tenant/onlinePaymentSchemas';
import { forgetPayment, paymentIdFromParams, useRememberedPayment } from '@/tenant/paymentReturn';

const CRUMBS = [{ label: 'Loyers', href: '/loyers' }, { label: 'Retour de paiement' }];

export function ApiPaymentReturnScreen() {
  const params = useSearchParams();
  const fromUrl = paymentIdFromParams(params);
  const remembered = useRememberedPayment();
  const id = fromUrl ?? remembered;
  return (
    <>
      <PageHeader title="Retour de paiement" crumbs={CRUMBS} subtitle="Le résultat de votre paiement, tel que confirmé par notre prestataire." />
      {id === undefined ? <Skeleton rows={2} /> : id === null ? <NoPayment /> : <PaymentStatus id={id} />}
    </>
  );
}

function NoPayment() {
  return (
    <Card className="max-w-xl gap-3 p-6">
      <h2 className="text-block-title">Aucun paiement à suivre</h2>
      <p className="text-body text-fg-muted">Nous ne retrouvons pas de paiement en cours depuis cet appareil. Consultez vos paiements pour vérifier leur état.</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/loyers/paiements">Voir mes paiements</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/loyers">Revenir à mes loyers</Link>
        </Button>
      </div>
    </Card>
  );
}

function PaymentStatus({ id }: { id: string }) {
  const payment = useOnlinePayment(id);
  const live = payment.data !== undefined && isLive(payment.data.status);
  useEffect(() => {
    if (payment.data !== undefined && !isLive(payment.data.status)) forgetPayment();
  }, [payment.data]);
  if (payment.data === undefined) {
    return payment.isError ? (
      <FailureAlert title="Le paiement n’a pas pu être consulté" error={payment.error} wording={ONLINE_PAYMENT_WORDING} onRetry={() => void payment.refetch()} />
    ) : (
      <Skeleton rows={2} />
    );
  }
  return (
    <>
      {payment.isError ? <FailureAlert title="L’état du paiement n’a pas pu être actualisé" error={payment.error} wording={ONLINE_PAYMENT_WORDING} onRetry={() => void payment.refetch()} /> : null}
      <PaymentCard payment={payment.data} stalled={payment.stalled} refreshing={payment.isFetching} onRefresh={() => void payment.refetch()} />
      {live ? <Cancel payment={payment.data} /> : null}
    </>
  );
}

function Outcome({ payment, stalled }: { payment: OnlinePayment; stalled: boolean }) {
  const retryHref = `/loyers/payer?bail=${payment.leaseId}`;
  switch (payment.status) {
    case 'succeeded':
      return (
        <Alert tone="success" title="Paiement confirmé">
          <span className="flex flex-wrap items-center gap-2">
            Merci, votre paiement est confirmé. Votre quittance vous est envoyée une fois le loyer soldé.
            <Button asChild variant="link" size="sm">
              <Link href="/loyers/quittances">Voir mes quittances</Link>
            </Button>
          </span>
        </Alert>
      );
    case 'failed':
      return (
        <Alert tone="danger" title="Paiement échoué">
          <span className="flex flex-wrap items-center gap-2">
            {(payment.failureCode === null ? undefined : FAILURE_LABEL[payment.failureCode]) ?? 'Le paiement n’a pas abouti. Aucun montant n’a été débité.'}
            <Button asChild variant="link" size="sm">
              <Link href={retryHref}>Réessayer</Link>
            </Button>
          </span>
        </Alert>
      );
    case 'cancelled':
    case 'expired':
      return (
        <Alert tone="info" title={payment.status === 'cancelled' ? 'Paiement annulé' : 'Paiement expiré'}>
          <span className="flex flex-wrap items-center gap-2">
            Aucun montant n’a été débité.
            <Button asChild variant="link" size="sm">
              <Link href={retryHref}>Lancer un nouveau paiement</Link>
            </Button>
          </span>
        </Alert>
      );
    default:
      return stalled ? (
        <Alert tone="warning" title="La confirmation tarde">
          Votre banque n’a pas encore confirmé le paiement. Vous pouvez quitter cette page : votre loyer sera marqué comme réglé dès la confirmation.
        </Alert>
      ) : (
        <Alert tone="info" title="Confirmation en cours">
          Nous attendons la confirmation de votre banque. Cette page se met à jour toute seule.
        </Alert>
      );
  }
}

function PaymentCard({ payment, stalled, refreshing, onRefresh }: { payment: OnlinePayment; stalled: boolean; refreshing: boolean; onRefresh: () => void }) {
  const status = ONLINE_STATUS_VIEW[payment.status];
  const resume = payment.status === 'pending' ? safeRedirect(payment.redirectUrl) : null;
  return (
    <>
      <Outcome payment={payment} stalled={stalled} />
      <Card role="region" aria-label="Détail du paiement" className="gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StatusBadge tone={status.tone} icon={payment.status === 'succeeded' ? CircleCheck : undefined}>
            {status.label}
          </StatusBadge>
          <span className="flex flex-wrap gap-2">
            {isLive(payment.status) ? (
              <Button variant="secondary" size="sm" loading={refreshing} onClick={onRefresh}>
                Actualiser
              </Button>
            ) : null}
            {resume === null ? null : (
              <Button size="sm" asChild>
                <a href={resume}>Reprendre le paiement</a>
              </Button>
            )}
          </span>
        </div>
        <KeyValueList
          labelWidth="8rem"
          items={[
            { label: 'Montant', value: formatApiMoney(payment.amount) },
            { label: 'Moyen', value: ONLINE_METHOD_LABEL[payment.method].label },
            { label: 'Échéances', value: String(payment.installmentIds.length) },
            { label: 'Lancé le', value: formatDateTime(payment.createdAt) },
            ...(payment.confirmedAt === null ? [] : [{ label: 'Confirmé le', value: formatDateTime(payment.confirmedAt) }]),
          ]}
        />
      </Card>
    </>
  );
}

function Cancel({ payment }: { payment: OnlinePayment }) {
  const cancel = useCancelOnlinePayment();
  const show = useFlash((state) => state.show);
  const [open, setOpen] = useState(false);
  if (payment.status !== 'pending') return null;
  const confirm = () => {
    cancel.mutate(payment.id, {
      onSuccess: () => {
        setOpen(false);
        forgetPayment();
        show({ tone: 'success', title: 'Paiement annulé', detail: 'Aucun montant n’a été débité.', path: '/loyers' });
      },
    });
  };
  return (
    <div>
      <Button variant="danger" onClick={() => { setOpen(true); }}>
        Annuler ce paiement
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Annuler ce paiement ?"
        description="Le paiement en attente sera annulé. Aucun montant ne sera débité : vous pourrez en lancer un nouveau."
        confirmLabel="Annuler le paiement"
        cancelLabel="Conserver le paiement"
        loading={cancel.isPending}
        onConfirm={confirm}
        error={cancel.isError ? describeFailure(cancel.error, ONLINE_PAYMENT_WORDING).message : undefined}
      />
    </div>
  );
}
