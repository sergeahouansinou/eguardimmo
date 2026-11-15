'use client';

import { Alert, Button, Card, CardHeader, CardTitle, Icon, TextField } from '@eguardimmo/ui';
import { CreditCard, Landmark, Lock, Repeat } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { RadioCards } from '@/components/RadioCards';
import type { RadioCardOption } from '@/components/RadioCards';
import { Async3 } from '@/components/ScreenState';
import { KeyValueList, TotalsList } from '@/components/Section';
import { useHome, useInstallments, useMandate, useStartPayment } from '@/data/queries';
import type { Installment, Mandate, PaymentMethod } from '@/data/schemas/loyers';
import { daysBetween, formatDate, plural } from '@/lib/dates';
import { formatAmount, formatMoney } from '@/lib/money';
import { maskIban } from '@/lib/iban';
import { METHOD_LABELS } from '../shared/status';

const total = (item: Installment) => item.rentCents + item.provisionsCents;

function methodOptions(mandate: Mandate): RadioCardOption<PaymentMethod>[] {
  const sepaReady = mandate.status === 'actif';
  return [
    { value: 'carte', label: METHOD_LABELS.carte, detail: 'Paiement immédiat, sans frais', icon: CreditCard },
    { value: 'virement', label: METHOD_LABELS.virement, detail: 'Reçu sous 1 à 2 jours ouvrés', icon: Landmark },
    {
      value: 'prelevement',
      label: METHOD_LABELS.prelevement,
      detail: sepaReady && mandate.ibanLast4 ? `Chaque mois, compte ${maskIban(mandate.ibanLast4)}` : 'Mandat à signer avant de pouvoir l’utiliser',
      icon: Repeat,
      disabled: !sepaReady,
    },
  ];
}

const METHOD_INFO: Record<PaymentMethod, string> = {
  carte:
    'Vous serez redirigé vers la page de paiement sécurisée de notre prestataire (simulation). Aucune donnée de carte n’est saisie ni conservée dans votre espace.',
  virement:
    'Le prestataire de démonstration vous indique les coordonnées de virement. Le loyer est soldé dès réception des fonds, sous 1 à 2 jours ouvrés.',
  prelevement: 'Le prélèvement est lancé sur le compte enregistré dans votre mandat SEPA. Le loyer est soldé à réception des fonds.',
};

export function PayerScreen() {
  const installments = useInstallments();
  const mandate = useMandate();
  const home = useHome();
  return (
    <Async3 a={installments} b={mandate} c={home} errorTitle="Le paiement n’a pas pu être préparé">
      {(items, mandateData, homeData) => <PayerFlow items={items} mandate={mandateData} today={homeData.today} />}
    </Async3>
  );
}

function PayerFlow({ items, mandate, today }: { items: Installment[]; mandate: Mandate; today: string }) {
  const router = useRouter();
  const requested = useSearchParams().get('echeance');
  const unpaid = items.filter((item) => item.status === 'impaye');
  const installment = unpaid.find((item) => item.id === requested) ?? unpaid[0];
  const [step, setStep] = useState<'moyen' | 'confirmation'>('moyen');
  const [method, setMethod] = useState<PaymentMethod>('carte');
  const start = useStartPayment();

  if (!installment) {
    return (
      <>
        <PageHeader title="Payer mon loyer" crumbs={[{ label: 'Loyers et quittances', href: '/loyers' }, { label: 'Payer mon loyer' }]} />
        <Card className="max-w-xl gap-3 p-6">
          <h2 className="text-block-title">Aucun loyer à régler</h2>
          <p className="text-body text-fg-muted">Toutes vos échéances échues sont soldées ou en cours de règlement.</p>
          <Button variant="secondary" asChild className="self-start">
            <Link href="/loyers">Revenir à mes loyers</Link>
          </Button>
        </Card>
      </>
    );
  }

  const late = daysBetween(installment.dueOn, today);
  const amount = total(installment);
  const pay = () => {
    start.mutate(
      { installmentId: installment.id, method },
      { onSuccess: (payment) => { router.push(`/loyers/payer/simulation/${payment.id}`); } },
    );
  };

  return (
    <>
      <PageHeader
        title="Payer mon loyer"
        crumbs={[{ label: 'Loyers et quittances', href: '/loyers' }, { label: 'Payer mon loyer' }]}
        subtitle={`Échéance du ${formatDate(installment.dueOn)}${late > 0 ? `, en retard de ${plural(late, 'jour', 'jours')}` : ''}.`}
      />
      <p className="text-caption text-fg-subtle" aria-live="polite">
        Étape {step === 'moyen' ? '1' : '2'} sur 2 · {step === 'moyen' ? 'Choix du moyen de paiement' : 'Confirmation'}
      </p>
      {start.isError ? (
        <Alert tone="danger" title="Le paiement n’a pas pu être lancé">
          {start.error.message}
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card role="region" aria-labelledby="pl-montant" className="px-4 py-3">
            <CardHeader>
              <CardTitle as="h2" id="pl-montant">Montant</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField label="Montant à payer" placeholder="850,00 €" readOnly value={formatMoney(amount, { fixed: true })} hint={`Loyer ${formatMoney(installment.rentCents)} et provisions ${formatMoney(installment.provisionsCents)}`} />
              <TextField label="Échéance" placeholder="01/11/2026" readOnly value={formatDate(installment.dueOn)} />
            </div>
          </Card>
          {step === 'moyen' ? (
            <Card role="region" aria-labelledby="pl-moyen" className="px-4 py-3">
              <CardHeader>
                <CardTitle as="h2" id="pl-moyen">Moyen de paiement</CardTitle>
              </CardHeader>
              <RadioCards legend="Moyen de paiement" options={methodOptions(mandate)} value={method} onValueChange={setMethod} />
              {mandate.status !== 'actif' ? (
                <Button variant="link" size="sm" asChild className="self-start">
                  <Link href="/loyers/prelevement">Activer le prélèvement SEPA</Link>
                </Button>
              ) : null}
              <Alert tone="info" title="Paiement sécurisé">
                {METHOD_INFO[method]}
              </Alert>
            </Card>
          ) : (
            <Card role="region" aria-labelledby="pl-confirmation" className="px-4 py-3">
              <CardHeader>
                <CardTitle as="h2" id="pl-confirmation">Confirmation</CardTitle>
              </CardHeader>
              <KeyValueList
                labelWidth="7rem"
                items={[
                  { label: 'Moyen', value: METHOD_LABELS[method] },
                  { label: 'Montant', value: formatMoney(amount, { fixed: true }) },
                  { label: 'Bénéficiaire', value: 'Gestion Les Tilleuls' },
                ]}
              />
              <Alert tone="info" title="Page de paiement simulée">
                {METHOD_INFO[method]}
              </Alert>
            </Card>
          )}
        </div>
        <Card role="region" aria-labelledby="pl-recap" className="px-4 py-3">
          <CardHeader>
            <CardTitle as="h2" id="pl-recap">Récapitulatif</CardTitle>
          </CardHeader>
          <TotalsList
            items={[
              { label: 'Loyer', value: `${formatAmount(installment.rentCents)} €` },
              { label: 'Provisions', value: `${formatAmount(installment.provisionsCents)} €` },
              { label: 'Frais', value: '0,00 €' },
              { label: 'Total', value: `${formatAmount(amount)} €`, strong: true },
            ]}
          />
          <p className="flex items-start gap-1.5 text-caption text-fg-subtle">
            <Icon icon={Lock} size={14} className="mt-0.5" />
            Paiement sécurisé. Une quittance vous est envoyée par e‑mail une fois le loyer soldé.
          </p>
        </Card>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" asChild>
          <Link href="/loyers">Annuler</Link>
        </Button>
        {step === 'moyen' ? (
          <Button onClick={() => { setStep('confirmation'); }}>Continuer</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => { setStep('moyen'); }}>Modifier le moyen</Button>
            <Button loading={start.isPending} onClick={pay}>
              <Icon icon={Lock} />
              Payer {formatMoney(amount, { fixed: true })}
            </Button>
          </>
        )}
      </div>
    </>
  );
}
