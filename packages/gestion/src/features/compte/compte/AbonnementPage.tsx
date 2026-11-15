'use client';

import { useState } from 'react';
import { Alert } from '@eguardimmo/ui';
import { ConfirmDialog, QueryState, pushFlash } from '../../outils/kit';
import type { ScreenProps } from '../../outils/kit';
import { formatDate } from '../shared/dates';
import { SettingsLayout } from '../shared/SettingsLayout';
import { CurrentPlanCard } from './CurrentPlanCard';
import { InvoicesCard } from './InvoicesCard';
import { PaymentDialog } from './PaymentDialog';
import { PlanCards } from './PlanCards';
import { limitsExceeded, planOf, priceLabel, priceOf } from './plans';
import type { Plan } from './plans';
import type { Billing, Subscription } from './schemas';
import { useInvoices, useSubscription, useSubscriptionActions } from './source';
import { UsageCard } from './UsageCard';

type DialogState =
  | { kind: 'payment' }
  | { kind: 'plan'; plan: Plan; billing: Billing }
  | { kind: 'billing'; billing: Billing }
  | { kind: 'cancel' }
  | null;

function planChangeText(subscription: Subscription, plan: Plan, billing: Billing): string {
  const price = priceLabel(priceOf(plan, billing), billing);
  const problems = limitsExceeded(plan, subscription.usage);
  const base = `La formule ${plan.name} (${price.amount} ${price.unit}) prend effet immédiatement, au prorata de la période en cours.`;
  return problems.length > 0 ? `${base} Attention : ${problems.join(', ')}.` : base;
}

function AbonnementContent({ subscription }: { subscription: Subscription }) {
  const actions = useSubscriptionActions();
  const invoices = useInvoices();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = [actions.changePlan, actions.changeBilling, actions.cancel].some((mutation) => mutation.isPending);

  const run = async (task: () => Promise<unknown>, message: string) => {
    setError(null);
    try {
      await task();
      pushFlash(message);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "L'opération a échoué. Réessayez.");
    }
    setDialog(null);
  };

  const plan = planOf(subscription.planId);
  return (
    <div className="grid grid-cols-1 items-start gap-3 min-[1400px]:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-3">
        {error ? <Alert tone="danger" title="Opération impossible">{error}</Alert> : null}
        <CurrentPlanCard
          subscription={subscription}
          onPayment={() => { setDialog({ kind: 'payment' }); }}
          onBilling={() => { setDialog({ kind: 'billing', billing: subscription.billing === 'annuel' ? 'mensuel' : 'annuel' }); }}
          onCancel={() => { setDialog({ kind: 'cancel' }); }}
          onResume={() => { void run(() => actions.resume.mutateAsync(undefined), 'Résiliation annulée : votre formule continue.'); }}
        />
        <PlanCards subscription={subscription} onChoose={(chosen, billing) => { setDialog({ kind: 'plan', plan: chosen, billing }); }} />
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <UsageCard subscription={subscription} plan={plan} />
        <QueryState query={invoices} errorTitle="Les factures n'ont pas pu être chargées" loadingLabel="Chargement des factures">
          {(list) => <InvoicesCard invoices={list} />}
        </QueryState>
      </div>
      <PaymentDialog open={dialog?.kind === 'payment'} onOpenChange={(open) => { if (!open) setDialog(null); }} method={subscription.paymentMethod} />
      {dialog?.kind === 'plan' ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => { if (!open) setDialog(null); }}
          title={`Passer à la formule ${dialog.plan.name} ?`}
          description={planChangeText(subscription, dialog.plan, dialog.billing)}
          confirmLabel="Confirmer le changement"
          tone="primary"
          pending={pending}
          onConfirm={() => {
            const { plan: target, billing } = dialog;
            void run(() => actions.changePlan.mutateAsync({ planId: target.id, billing }), `Formule ${target.name} activée.`);
          }}
        />
      ) : null}
      {dialog?.kind === 'billing' ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => { if (!open) setDialog(null); }}
          title={dialog.billing === 'annuel' ? 'Passer en paiement annuel ?' : 'Passer en paiement mensuel ?'}
          description={
            dialog.billing === 'annuel'
              ? `${priceLabel(priceOf(plan, 'annuel'), 'annuel').amount} facturés par an, soit 2 mois offerts, à partir du ${formatDate(subscription.nextChargeDate)}.`
              : `${priceLabel(priceOf(plan, 'mensuel'), 'mensuel').amount} facturés chaque mois, à partir du ${formatDate(subscription.nextChargeDate)}.`
          }
          confirmLabel="Confirmer"
          tone="primary"
          pending={pending}
          onConfirm={() => {
            const { billing } = dialog;
            void run(() => actions.changeBilling.mutateAsync(billing), billing === 'annuel' ? 'Paiement annuel activé.' : 'Paiement mensuel activé.');
          }}
        />
      ) : null}
      {dialog?.kind === 'cancel' ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => { if (!open) setDialog(null); }}
          title="Résilier la formule ?"
          description={`La formule ${plan.name} reste active jusqu'au ${formatDate(subscription.nextChargeDate)}, sans nouveau prélèvement. Vous pourrez annuler la résiliation avant cette date.`}
          confirmLabel="Résilier la formule"
          cancelLabel="Garder la formule"
          pending={pending}
          onConfirm={() => { void run(() => actions.cancel.mutateAsync(undefined), `Résiliation programmée au ${formatDate(subscription.nextChargeDate)}.`); }}
        />
      ) : null}
    </div>
  );
}

export function AbonnementPage({ Link }: ScreenProps) {
  const query = useSubscription();
  return (
    <SettingsLayout Link={Link} section="abonnement" description="Votre formule, son utilisation et vos factures eGuardImmo.">
      <QueryState query={query} errorTitle="L'abonnement n'a pas pu être chargé" loadingLabel="Chargement de l'abonnement">
        {(subscription) => <AbonnementContent subscription={subscription} />}
      </QueryState>
    </SettingsLayout>
  );
}
