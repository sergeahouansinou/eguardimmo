'use client';

import { Check } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Icon, cx } from '@eguardimmo/ui';
import { Segmented } from '../../outils/kit';
import { SettingsCard } from '../shared/SettingRow';
import { PLANS, priceLabel, priceOf } from './plans';
import type { Plan } from './plans';
import { BILLINGS } from './schemas';
import type { Billing, Subscription } from './schemas';

function PlanCard({ plan, billing, current, onChoose }: { plan: Plan; billing: Billing; current: boolean; onChoose: (plan: Plan) => void }) {
  const price = priceLabel(priceOf(plan, billing), billing);
  return (
    <li className={cx('flex min-w-0 flex-col gap-2 rounded-lg border p-3', current ? 'border-2 border-action p-[11px]' : 'border-line')}>
      <div className="flex items-center justify-between gap-2 text-body-strong text-fg">
        <span>{plan.name}</span>
        {current ? <Badge tone="info">Actuelle</Badge> : null}
      </div>
      <div className="text-[24px] leading-8 font-semibold whitespace-nowrap text-fg tabular-nums">
        {price.amount} <small className="text-caption font-normal text-fg-subtle">{price.unit}</small>
      </div>
      <ul className="flex flex-col gap-1.5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-center gap-1.5 text-[13px] leading-5 text-fg-muted">
            <Icon icon={Check} size={14} className="text-action" />
            {feature}
          </li>
        ))}
      </ul>
      {current ? (
        <Button variant="ghost" className="mt-auto" disabled>
          Formule actuelle
        </Button>
      ) : (
        <Button variant={plan.id === 'gold' ? 'primary' : 'secondary'} className="mt-auto" onClick={() => { onChoose(plan); }}>
          {plan.switchLabel}
        </Button>
      )}
    </li>
  );
}

export function PlanCards({ subscription, onChoose }: { subscription: Subscription; onChoose: (plan: Plan, billing: Billing) => void }) {
  const [billing, setBilling] = useState<Billing>(subscription.billing);
  return (
    <SettingsCard
      id="ab-pl"
      title="Changer de formule"
      aside={
        <Segmented
          label="Périodicité"
          value={billing}
          onValueChange={setBilling}
          options={BILLINGS.map((value) => ({ value, label: value === 'mensuel' ? 'Mensuel' : 'Annuel' }))}
        />
      }
    >
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            billing={billing}
            current={plan.id === subscription.planId && billing === subscription.billing}
            onChoose={(chosen) => { onChoose(chosen, billing); }}
          />
        ))}
      </ul>
      <span className="text-caption text-fg-subtle">Prix HT, TVA ajoutée à la facturation. Un changement prend effet immédiatement, au prorata de la période en cours.</span>
    </SettingsCard>
  );
}
