'use client';

import { Alert, Button, Card, CardHeader, CardTitle, Icon } from '@eguardimmo/ui';
import { CreditCard, Download, FileText, Mail, ReceiptText, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Async3, NotFoundState } from '@/components/ScreenState';
import { PageHeader } from '@/components/PageHeader';
import { KeyValueList, ListRow } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import { useInstallments, usePayment, useProfile, useSettlePayment } from '@/data/queries';
import type { Installment, Payment } from '@/data/schemas/loyers';
import type { Profile } from '@/data/schemas/compte';
import { daysBetween, formatDate, formatDateTime, monthOf, plural } from '@/lib/dates';
import { downloadDemoPdf } from '@eguardimmo/shell';
import { formatMoney } from '@/lib/money';
import { METHOD_LABELS, paymentStatus } from '../shared/status';

export function PaymentStatusScreen({ paymentId }: { paymentId: string }) {
  const payment = usePayment(paymentId);
  const installments = useInstallments();
  const profile = useProfile();
  return (
    <Async3 a={payment} b={installments} c={profile} errorTitle="L’état du paiement n’a pas pu être chargé">
      {(data, items, profileData) => {
        const installment = data ? items.find((item) => item.id === data.installmentId) : undefined;
        if (!data || !installment) {
          return <NotFoundState title="Paiement introuvable" backHref="/loyers" backLabel="Revenir à mes loyers" />;
        }
        return <PaymentStatus payment={data} installment={installment} profile={profileData} />;
      }}
    </Async3>
  );
}

function PaymentStatus({ payment, installment, profile }: { payment: Payment; installment: Installment; profile: Profile }) {
  const view = paymentStatus(payment.status);
  const amount = formatMoney(payment.amountCents, { fixed: true });
  const titles: Record<Payment['status'], string> = {
    reussi: 'Paiement reçu',
    en_attente: 'Paiement en attente',
    en_cours: 'Paiement en cours',
    echoue: 'Paiement échoué',
    annule: 'Paiement annulé',
  };
  return (
    <>
      <PageHeader
        title={titles[payment.status]}
        crumbs={[{ label: 'Loyers et quittances', href: '/loyers' }, { label: view.label === 'Confirmé' ? 'Paiement confirmé' : `Paiement ${view.label.toLowerCase()}` }]}
        badge={<StatusBadge tone={view.tone} icon={view.icon}>{view.label}</StatusBadge>}
        subtitle={
          payment.status === 'reussi'
            ? `Votre loyer ${monthOf(installment.id)} ${installment.id.slice(0, 4)} est réglé.`
            : `Loyer ${monthOf(installment.id)} ${installment.id.slice(0, 4)}, ${amount}.`
        }
        actions={
          <>
            {payment.status === 'reussi' ? (
              <Button
                variant="secondary"
                onClick={() => { downloadDemoPdf(`recu-${payment.id}.pdf`, `Reçu de paiement ${payment.id}`, [amount, formatDate(installment.dueOn)]); }}
              >
                <Icon icon={Download} />
                Télécharger le reçu
              </Button>
            ) : null}
            <Button asChild>
              <Link href="/loyers">
                <Icon icon={ReceiptText} />
                Voir mes loyers
              </Link>
            </Button>
          </>
        }
      />
      <StatusMessage payment={payment} installment={installment} amount={amount} />
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card role="region" aria-labelledby="ps-detail" className="px-4 py-3">
          <CardHeader>
            <CardTitle as="h2" id="ps-detail">Détail du paiement</CardTitle>
          </CardHeader>
          <KeyValueList
            labelWidth="7rem"
            items={[
              { label: 'Montant', value: amount },
              { label: 'Échéance', value: `${formatDate(installment.dueOn)}, loyer et provisions` },
              { label: 'Moyen', value: payment.method === 'carte' ? 'Carte bancaire (simulation)' : METHOD_LABELS[payment.method] },
              { label: 'Date', value: formatDateTime(payment.completedAt ?? payment.createdAt) },
              { label: 'Référence', value: payment.id },
              { label: 'Bailleur', value: 'Gestion Les Tilleuls' },
            ]}
          />
        </Card>
        <Card role="region" aria-labelledby="ps-suite" className="px-4 py-3">
          <CardHeader>
            <CardTitle as="h2" id="ps-suite">Et maintenant</CardTitle>
          </CardHeader>
          <NextSteps payment={payment} installment={installment} profile={profile} />
        </Card>
      </div>
    </>
  );
}

function StatusMessage({ payment, installment, amount }: { payment: Payment; installment: Installment; amount: string }) {
  const settle = useSettlePayment();
  const done = payment.completedAt ?? payment.createdAt;
  if (payment.status === 'reussi') {
    const late = daysBetween(installment.dueOn, done.slice(0, 10));
    return (
      <Alert tone="success" title={`${amount} reçus le ${formatDate(done)}`}>
        L’échéance du {formatDate(installment.dueOn)} est soldée.{late > 0 ? ` Le retard de ${plural(late, 'jour', 'jours')} est clos.` : ''}
      </Alert>
    );
  }
  if (payment.status === 'en_attente') {
    return (
      <Alert tone="warning" title="Paiement en attente de réception">
        Le prestataire de démonstration a enregistré votre ordre. Le loyer sera soldé à la réception des fonds.
        <div className="mt-1.5">
          <Button size="sm" variant="secondary" loading={settle.isPending} onClick={() => { settle.mutate(payment.id); }}>
            Simuler la réception des fonds
          </Button>
        </div>
        {settle.isError ? <p role="alert" className="mt-1 text-fg-danger">{settle.error.message}</p> : null}
      </Alert>
    );
  }
  if (payment.status === 'echoue') {
    return (
      <Alert tone="danger" title="Le paiement n’a pas abouti">
        {payment.failureReason ?? 'Le paiement a été refusé.'} Aucun montant n’a été débité.
        <div className="mt-1.5">
          <Button size="sm" asChild>
            <Link href={`/loyers/payer?echeance=${installment.id}`}>Réessayer le paiement</Link>
          </Button>
        </div>
      </Alert>
    );
  }
  if (payment.status === 'annule') {
    return (
      <Alert tone="info" title="Paiement annulé">
        Vous avez annulé ce paiement : l’échéance du {formatDate(installment.dueOn)} reste à régler.
        <div className="mt-1.5">
          <Button size="sm" asChild>
            <Link href={`/loyers/payer?echeance=${installment.id}`}>Reprendre le paiement</Link>
          </Button>
        </div>
      </Alert>
    );
  }
  return (
    <Alert tone="info" title="Paiement en cours">
      Le paiement n’est pas terminé.
      <div className="mt-1.5">
        <Button size="sm" asChild>
          <Link href={`/loyers/payer/simulation/${payment.id}`}>
            <Icon icon={CreditCard} />
            Reprendre sur la page de paiement
          </Link>
        </Button>
      </div>
    </Alert>
  );
}

function NextSteps({ payment, installment, profile }: { payment: Payment; installment: Installment; profile: Profile }) {
  if (payment.status === 'reussi') {
    return (
      <ul>
        <ListRow
          icon={Mail}
          title={`Quittance ${monthOf(installment.id)}`}
          detail={`Envoyée sous 24 h à ${profile.email}`}
          trailing={
            payment.receiptId ? (
              <Button variant="link" size="sm" asChild>
                <Link href={`/loyers/quittances/${payment.receiptId}`}>Voir</Link>
              </Button>
            ) : null
          }
        />
        <ListRow icon={ShieldCheck} tone="success" title="Gestion Les Tilleuls prévenue" detail="Le gestionnaire voit le règlement" />
      </ul>
    );
  }
  return (
    <ul>
      <ListRow icon={FileText} title="Aucune quittance pour l’instant" detail="Elle est émise dès que l’échéance est intégralement soldée" />
    </ul>
  );
}

