"use client";

import { Card, CardHeader, CardTitle } from "@eguardimmo/ui";
import { useState } from "react";
import { QueryState } from "@/components/ui/QueryState";
import { SettingsPage } from "@/features/kit";
import { formatDate } from "@/features/shared/dates";
import { BillingCard } from "./BillingCard";
import { useSubscription } from "./hooks";
import { PaymentMethodDialog } from "./PaymentMethodDialog";
import { PaymentMethodsCard } from "./PaymentMethodsCard";
import { PlansCard } from "./PlansCard";
import type { SubscriptionView } from "./subscriptionSchemas";
import { TrialCard } from "./TrialCard";
import { UsageCard } from "./UsageCard";

function SubscriptionContent({ subscription }: { subscription: SubscriptionView }) {
  const [adding, setAdding] = useState<"card" | "sepa" | null>(null);
  return (
    <SettingsPage currentHref="/compte/abonnement" subtitle="Votre essai gratuit, la formule choisie et la facturation eGuardImmo.">
      <div className="grid min-w-0 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_18.75rem]">
        <div className="flex min-w-0 flex-col gap-3">
          <TrialCard
            subscription={subscription}
            onAddPayment={() => {
              setAdding("card");
            }}
          />
          <PlansCard subscription={subscription} />
          <PaymentMethodsCard methods={subscription.paymentMethods} onAdd={setAdding} />
          <BillingCard billing={subscription.billing} />
        </div>
        <aside className="flex min-w-0 flex-col gap-3">
          <UsageCard usage={subscription.usage} />
          <Card role="region" aria-label="Factures">
            <CardHeader>
              <CardTitle as="h2">Factures</CardTitle>
            </CardHeader>
            <p className="text-body text-fg-muted">
              {`Aucune facture pendant l'essai. La première sera émise le ${formatDate(subscription.firstCharge.date)}.`}
            </p>
          </Card>
        </aside>
      </div>
      {adding ? (
        <PaymentMethodDialog
          kind={adding}
          onClose={() => {
            setAdding(null);
          }}
        />
      ) : null}
    </SettingsPage>
  );
}

export function SubscriptionPage() {
  const query = useSubscription();
  return (
    <QueryState query={query} label="L'abonnement">
      {(subscription) => <SubscriptionContent subscription={subscription} />}
    </QueryState>
  );
}
