'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Card, CardHeader, CardTitle, Icon } from '@eguardimmo/ui';
import { CreditCard, Landmark, Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { CheckboxField } from '@/components/CheckboxField';
import { FailureAlert } from '@/components/FailureAlert';
import { LeaseGate } from '@/components/LeaseGate';
import { PageHeader } from '@/components/PageHeader';
import { RadioCards } from '@/components/RadioCards';
import type { RadioCardOption } from '@/components/RadioCards';
import { Skeleton } from '@/components/ScreenState';
import { TotalsList } from '@/components/Section';
import { formatDate } from '@/lib/dates';
import { useAttemptKey } from '@/tenant/clientId';
import { formatApiMoney } from '@/tenant/format';
import { isUuid } from '@/tenant/ids';
import type { LeaseSummary, Money } from '@/tenant/model';
import { ONLINE_METHOD_LABEL, ONLINE_PAYMENT_WORDING, UNAVAILABLE_REASON } from '@/tenant/onlinePaymentLabels';
import { useCreateOnlinePayment, usePaymentOptions } from '@/tenant/onlinePaymentQueries';
import { isLive, safeRedirect } from '@/tenant/onlinePaymentSchemas';
import type { OnlineMethod, PaymentOptions } from '@/tenant/onlinePaymentSchemas';
import { rememberPayment } from '@/tenant/paymentReturn';
import { useSelectedLease } from '@/tenant/selectedLease';
import { payFormSchema } from './payForm';
import type { PayValues } from './payForm';

const CRUMBS = [{ label: 'Loyers', href: '/loyers' }, { label: 'Payer mon loyer' }];
const METHOD_ICON: Record<OnlineMethod, typeof CreditCard> = { card: CreditCard, direct_debit: Landmark };
const GENERIC_UNAVAILABLE = 'Le paiement en ligne n’est pas disponible pour ce bail. Réglez votre loyer par les moyens habituels indiqués par votre agence.';

export function ApiPayerScreen() {
  const selection = useSelectedLease();
  return (
    <>
      <PageHeader title="Payer mon loyer" crumbs={CRUMBS} subtitle="Vous réglez sur la page sécurisée de notre prestataire de paiement." />
      <LeaseGate selection={selection} errorTitle="Vos baux n’ont pas pu être chargés">
        {(lease) => <PayContent key={lease.id} lease={lease} />}
      </LeaseGate>
    </>
  );
}

function PayContent({ lease }: { lease: LeaseSummary }) {
  const options = usePaymentOptions(lease.id);
  if (options.data === undefined) {
    return options.isError ? (
      <FailureAlert title="Le paiement n’a pas pu être préparé" error={options.error} wording={ONLINE_PAYMENT_WORDING} onRetry={() => void options.refetch()} />
    ) : (
      <Skeleton rows={2} />
    );
  }
  const data = options.data;
  if (!data.available || data.methods.length === 0 || data.installments.length === 0) {
    const reason = data.unavailableReason === null ? undefined : UNAVAILABLE_REASON[data.unavailableReason];
    return (
      <Card className="max-w-xl gap-3 p-6">
        <h2 className="text-block-title">Paiement en ligne indisponible</h2>
        <p className="text-body text-fg-muted">{reason ?? GENERIC_UNAVAILABLE}</p>
        <Button variant="secondary" asChild className="self-start">
          <Link href="/loyers">Revenir à mes loyers</Link>
        </Button>
      </Card>
    );
  }
  return <PayForm lease={lease} options={data} />;
}

function sum(amounts: readonly Money[]): Money | null {
  const first = amounts[0];
  if (first === undefined) return null;
  return { amount: amounts.reduce((total, item) => total + item.amount, 0), currency: first.currency };
}

function PayForm({ lease, options }: { lease: LeaseSummary; options: PaymentOptions }) {
  const router = useRouter();
  const requested = useSearchParams().get('echeance');
  const pay = useCreateOnlinePayment();
  const attemptKey = useAttemptKey();
  const [unsafeRedirect, setUnsafeRedirect] = useState<string | null>(null);
  const preselected = isUuid(requested) && options.installments.some((item) => item.id === requested) ? [requested] : options.installments.map((item) => item.id);
  const firstMethod = options.methods[0] ?? 'card';
  const form = useForm<PayValues>({
    resolver: zodResolver(payFormSchema),
    defaultValues: { installmentIds: preselected, method: firstMethod },
  });
  const { handleSubmit, control, formState } = form;
  const selectedIds = useWatch({ control, name: 'installmentIds' });
  const method = useWatch({ control, name: 'method' });
  const chosen = options.installments.filter((item) => selectedIds.includes(item.id));
  const total = sum(chosen.map((item) => item.remaining));

  const methodOptions: RadioCardOption<OnlineMethod>[] = options.methods.map((item) => ({
    value: item,
    label: ONLINE_METHOD_LABEL[item].label,
    detail: ONLINE_METHOD_LABEL[item].detail,
    icon: METHOD_ICON[item],
  }));

  const submit = handleSubmit((values) => {
    const ids = [...values.installmentIds].sort();
    const clientId = attemptKey([lease.id, values.method, ...ids].join('|'));
    pay.mutate(
      { leaseId: lease.id, installmentIds: ids, method: values.method, clientId },
      {
        onSuccess: (payment) => {
          rememberPayment(payment.id);
          const target = safeRedirect(payment.redirectUrl);
          if (isLive(payment.status) && target !== null) {
            globalThis.location.assign(target);
            return;
          }
          if (isLive(payment.status)) {
            setUnsafeRedirect(payment.id);
            return;
          }
          router.push(`/paiement/retour?paiement=${payment.id}`);
        },
      },
    );
  });

  return (
    <form onSubmit={(event) => { void submit(event); }} noValidate className="flex flex-col gap-3">
      {pay.isError ? <FailureAlert title="Le paiement n’a pas pu être lancé" error={pay.error} wording={ONLINE_PAYMENT_WORDING} /> : null}
      {unsafeRedirect === null ? null : (
        <Alert tone="danger" title="Page de paiement indisponible">
          <span className="flex flex-wrap items-center gap-2">
            Le prestataire n’a pas fourni d’adresse de paiement sûre. Aucun montant n’a été débité.
            <Button asChild variant="link" size="sm">
              <Link href={`/paiement/retour?paiement=${unsafeRedirect}`}>Suivre ou annuler ce paiement</Link>
            </Button>
          </span>
        </Alert>
      )}
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card role="region" aria-labelledby="pl-echeances" className="px-4 py-3">
            <CardHeader>
              <CardTitle as="h2" id="pl-echeances">Échéances à régler</CardTitle>
            </CardHeader>
            <Controller
              control={control}
              name="installmentIds"
              render={({ field }) => (
                <fieldset className="flex min-w-0 flex-col gap-2">
                  <legend className="sr-only">Échéances à régler</legend>
                  {options.installments.map((item) => (
                    <CheckboxField
                      key={item.id}
                      checked={field.value.includes(item.id)}
                      onChange={(event) => {
                        field.onChange(event.target.checked ? [...field.value, item.id] : field.value.filter((id) => id !== item.id));
                      }}
                    >
                      Échéance du {formatDate(item.dueOn)} : reste {formatApiMoney(item.remaining)}
                    </CheckboxField>
                  ))}
                  {formState.errors.installmentIds ? <p role="alert" className="text-caption text-fg-danger">{formState.errors.installmentIds.message}</p> : null}
                </fieldset>
              )}
            />
          </Card>
          <Card role="region" aria-labelledby="pl-moyen" className="px-4 py-3">
            <CardHeader>
              <CardTitle as="h2" id="pl-moyen">Moyen de paiement</CardTitle>
            </CardHeader>
            <Controller
              control={control}
              name="method"
              render={({ field }) => <RadioCards legend="Moyen de paiement" options={methodOptions} value={field.value} onValueChange={field.onChange} error={formState.errors.method?.message} />}
            />
            <Alert tone="info" title="Paiement sécurisé">
              Vous serez redirigé vers la page sécurisée de notre prestataire. Aucune donnée de carte ou de compte n’est saisie ni conservée dans votre espace.
            </Alert>
          </Card>
        </div>
        <Card role="region" aria-labelledby="pl-recap" className="px-4 py-3">
          <CardHeader>
            <CardTitle as="h2" id="pl-recap">Récapitulatif</CardTitle>
          </CardHeader>
          <TotalsList
            items={[
              { label: 'Échéances', value: String(chosen.length) },
              { label: 'Moyen', value: ONLINE_METHOD_LABEL[method].label },
              { label: 'Total', value: total === null ? '—' : formatApiMoney(total), strong: true },
            ]}
          />
          <p className="flex items-start gap-1.5 text-caption text-fg-subtle">
            <Icon icon={Lock} size={14} className="mt-0.5" />
            Une quittance vous est envoyée une fois le loyer soldé.
          </p>
        </Card>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" asChild>
          <Link href="/loyers">Annuler</Link>
        </Button>
        <Button type="submit" loading={pay.isPending} disabled={total === null}>
          <Icon icon={Lock} />
          {total === null ? 'Payer' : `Payer ${formatApiMoney(total)}`}
        </Button>
      </div>
    </form>
  );
}
