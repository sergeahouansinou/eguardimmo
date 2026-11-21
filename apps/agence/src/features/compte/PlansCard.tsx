import { Badge, Button, Card, CardHeader, CardTitle, SegmentedControl, cx } from "@eguardimmo/ui";
import { useState } from "react";
import { ActionDialog, SummaryLines, useNotify } from "@/features/kit";
import { formatDate } from "@/features/shared/dates";
import { messageOf } from "@/features/shared/errors";
import { useChangePlan } from "./hooks";
import { planPrice } from "./subscriptionFormat";
import type { BillingPeriod, Plan, SubscriptionView } from "./subscriptionSchemas";

const PERIOD_OPTIONS = [
  { value: "monthly", label: "Mensuel" },
  { value: "yearly", label: "Annuel" },
] as const;

export function PlansCard({ subscription }: { subscription: SubscriptionView }) {
  const notify = useNotify();
  const change = useChangePlan();
  const [period, setPeriod] = useState<BillingPeriod>(subscription.billingPeriod);
  const [target, setTarget] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const targetPrice = target ? planPrice(target, period) : null;

  const confirm = async () => {
    if (!target) return;
    setError(null);
    try {
      await change.mutateAsync({ planId: target.id, period });
      notify.success(`Formule ${target.name} activée`, "Le changement prend effet immédiatement.");
      setTarget(null);
    } catch (failure) {
      setError(messageOf(failure));
    }
  };

  return (
    <Card role="region" aria-label="Choisir une formule">
      <CardHeader className="flex-wrap">
        <CardTitle as="h2">Choisir une formule</CardTitle>
        <SegmentedControl
          label="Périodicité"
          options={PERIOD_OPTIONS}
          value={period}
          onValueChange={(value) => {
            setPeriod(value === "yearly" ? "yearly" : "monthly");
          }}
        />
      </CardHeader>
      <div className="grid gap-3 sm:grid-cols-3">
        {subscription.plans.map((plan) => {
          const price = planPrice(plan, period);
          return (
            <section
              key={plan.id}
              aria-label={`Formule ${plan.name}`}
              className={cx("flex min-w-0 flex-col gap-2 rounded-md border p-3", plan.current ? "border-action bg-action-subtle" : "border-line")}
            >
              <div className="flex flex-wrap items-center justify-between gap-1">
                <h3 className="text-body-strong text-fg">{plan.name}</h3>
                {plan.current ? <Badge tone="info">Essai en cours</Badge> : null}
              </div>
              <p className="text-block-title text-fg">
                {price.amount}
                <small className="ml-1 text-caption font-normal text-fg-subtle">{price.unit}</small>
              </p>
              <ul className="flex flex-1 list-disc flex-col gap-0.5 pl-4 text-body text-fg-muted">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              {plan.current ? (
                <Button variant="secondary" disabled>
                  Formule de l'essai
                </Button>
              ) : (
                <Button
                  variant={plan.id === "gold" ? "primary" : "secondary"}
                  onClick={() => {
                    setError(null);
                    setTarget(plan);
                  }}
                >
                  {`Choisir ${plan.name}`}
                </Button>
              )}
            </section>
          );
        })}
      </div>
      <p className="text-caption text-fg-subtle">Prix hors taxes. Le changement de formule prend effet immédiatement.</p>
      <ActionDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        title={target ? `Choisir la formule ${target.name} ?` : "Choisir une formule"}
        description={`Le changement prend effet immédiatement. L'essai gratuit se poursuit jusqu'au ${formatDate(subscription.trial.endDate)}.`}
        confirmLabel={target ? `Choisir ${target.name}` : "Choisir"}
        loading={change.isPending}
        error={error}
        onConfirm={() => void confirm()}
      >
        {target && targetPrice ? (
          <SummaryLines
            lines={[
              { label: "Formule", value: target.name },
              { label: "Périodicité", value: period === "yearly" ? "Annuelle" : "Mensuelle" },
              { label: "Montant", value: `${targetPrice.amount} ${targetPrice.unit}` },
            ]}
          />
        ) : null}
      </ActionDialog>
    </Card>
  );
}
