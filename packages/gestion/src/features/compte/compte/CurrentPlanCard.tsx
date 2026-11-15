import { CreditCard, RefreshCw, Zap } from 'lucide-react';
import { Alert, Button, Icon } from '@eguardimmo/ui';
import { formatDate } from '../shared/dates';
import { SettingsCard } from '../shared/SettingRow';
import { planOf, priceLabel, priceOf } from './plans';
import type { Subscription } from './schemas';

export interface CurrentPlanCardProps {
  subscription: Subscription;
  onPayment: () => void;
  onBilling: () => void;
  onCancel: () => void;
  onResume: () => void;
}

export function CurrentPlanCard({ subscription, onPayment, onBilling, onCancel, onResume }: CurrentPlanCardProps) {
  const plan = planOf(subscription.planId);
  const price = priceLabel(priceOf(plan, subscription.billing), subscription.billing);
  const annual = subscription.billing === 'annuel';
  const method = `${subscription.paymentMethod.brand} •••• ${subscription.paymentMethod.last4}`;
  const free = plan.monthly === 0;
  return (
    <SettingsCard id="ab-cur" title="Formule actuelle">
      <div className="flex flex-wrap items-center gap-4">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-nav text-accent">
          <Icon icon={Zap} size={20} />
        </span>
        <div className="flex min-w-0 flex-1 basis-56 flex-col">
          <b className="text-[16px] leading-6 font-semibold text-fg">{`${plan.name}, paiement ${annual ? 'annuel' : 'mensuel'}`}</b>
          <span className="text-caption text-fg-subtle">
            {free
              ? 'Aucun prélèvement.'
              : subscription.cancelAt
                ? `Fin de la formule le ${formatDate(subscription.cancelAt)}, sans nouveau prélèvement.`
                : `Prochain prélèvement le ${formatDate(subscription.nextChargeDate)}, ${method}`}
          </span>
        </div>
        <span className="text-[20px] leading-7 font-semibold whitespace-nowrap text-fg tabular-nums">
          {price.amount} <small className="text-caption font-normal text-fg-subtle">{price.unit}</small>
        </span>
      </div>
      {subscription.cancelAt ? (
        <Alert tone="warning">
          La résiliation est programmée au {formatDate(subscription.cancelAt)}. Vous gardez l'accès à la formule {plan.name} jusqu'à cette date.
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {free ? null : (
          <Button variant="secondary" size="sm" onClick={onPayment}>
            <Icon icon={CreditCard} />
            Modifier le moyen de paiement
          </Button>
        )}
        {free ? null : (
          <Button variant="secondary" size="sm" onClick={onBilling}>
            <Icon icon={RefreshCw} />
            {annual ? 'Passer en mensuel' : 'Passer en annuel'}
          </Button>
        )}
        {free ? null : subscription.cancelAt ? (
          <Button variant="ghost" size="sm" onClick={onResume}>
            Annuler la résiliation
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Résilier la formule
          </Button>
        )}
      </div>
    </SettingsCard>
  );
}
