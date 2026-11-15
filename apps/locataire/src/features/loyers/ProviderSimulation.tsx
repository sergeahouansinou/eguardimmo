'use client';

import { Alert, Button, Card, CardHeader, CardTitle, Icon } from '@eguardimmo/ui';
import { CircleCheck, CircleX, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Async, NotFoundState } from '@/components/ScreenState';
import { KeyValueList } from '@/components/Section';
import { usePayment, useResolvePayment } from '@/data/queries';
import type { Payment, PaymentOutcome } from '@/data/schemas/loyers';
import { formatMoney } from '@/lib/money';
import { METHOD_LABELS } from '../shared/status';

export function ProviderSimulation({ paymentId }: { paymentId: string }) {
  const payment = usePayment(paymentId);
  return (
    <Async query={payment} errorTitle="La page de paiement n’a pas pu être chargée">
      {(data) =>
        data ? (
          <Simulation payment={data} />
        ) : (
          <NotFoundState title="Paiement introuvable" backHref="/loyers" backLabel="Revenir à mes loyers" />
        )
      }
    </Async>
  );
}

function Simulation({ payment }: { payment: Payment }) {
  const router = useRouter();
  const resolve = useResolvePayment();
  const open = payment.status === 'en_cours';

  useEffect(() => {
    if (!open && !resolve.isPending) router.replace(`/loyers/paiements/${payment.id}`);
  }, [open, resolve.isPending, router, payment.id]);

  const conclude = (outcome: PaymentOutcome) => {
    resolve.mutate(
      { paymentId: payment.id, outcome },
      { onSuccess: () => { router.push(`/loyers/paiements/${payment.id}`); } },
    );
  };

  if (!open) return null;
  return (
    <>
      <PageHeader title="Paiement sécurisé" subtitle="Page du prestataire de paiement de démonstration." />
      <Alert tone="warning" title="Simulation, aucun argent n’est débité">
        Cette page remplace le prestataire de paiement réel. Aucune donnée de carte ni de compte n’est demandée : choisissez simplement le résultat à simuler.
      </Alert>
      {resolve.isError ? (
        <Alert tone="danger" title="Le résultat n’a pas pu être enregistré">
          {resolve.error.message}
        </Alert>
      ) : null}
      <Card role="region" aria-labelledby="sim-detail" className="max-w-2xl px-4 py-3">
        <CardHeader>
          <CardTitle as="h2" id="sim-detail">Votre paiement</CardTitle>
        </CardHeader>
        <KeyValueList
          labelWidth="7rem"
          items={[
            { label: 'Bénéficiaire', value: 'Gestion Les Tilleuls' },
            { label: 'Référence', value: payment.id },
            { label: 'Moyen', value: METHOD_LABELS[payment.method] },
            { label: 'Montant', value: <b>{formatMoney(payment.amountCents, { fixed: true })}</b> },
          ]}
        />
        <div className="flex flex-wrap gap-2 pt-2">
          <Button loading={resolve.isPending && resolve.variables.outcome === 'reussi'} disabled={resolve.isPending} onClick={() => { conclude('reussi'); }}>
            <Icon icon={CircleCheck} />
            Simuler un paiement réussi
          </Button>
          <Button variant="secondary" disabled={resolve.isPending} onClick={() => { conclude('echoue'); }}>
            <Icon icon={ShieldAlert} />
            Simuler un échec
          </Button>
          <Button variant="ghost" disabled={resolve.isPending} onClick={() => { conclude('annule'); }}>
            <Icon icon={CircleX} />
            Annuler et revenir
          </Button>
        </div>
      </Card>
    </>
  );
}
