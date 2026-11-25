"use client";

import { Button, cx } from "@eguardimmo/ui";
import { useState } from "react";
import { PLACEHOLDER, QUOTE } from "@/lib/pricing";
import type { PlanView } from "@/lib/pricing";
import { LinkButton } from "./LinkButton";

type Period = "monthly" | "yearly";

const PERIODS: readonly { value: Period; label: string; unit: string }[] = [
  { value: "monthly", label: "Mensuel", unit: "par mois" },
  { value: "yearly", label: "Annuel", unit: "par an" },
];

function priceOf(plan: PlanView, period: Period): { text: string; unit: string | null; configured: boolean } {
  if (plan.quote) return { text: QUOTE, unit: null, configured: false };
  const amount = period === "monthly" ? plan.monthly : plan.yearly;
  const unit = PERIODS.find((entry) => entry.value === period)?.unit ?? null;
  return amount === null ? { text: PLACEHOLDER, unit: null, configured: false } : { text: amount, unit, configured: true };
}

export function PricingPlans({ plans, showPeriods }: { plans: readonly PlanView[]; showPeriods: boolean }) {
  const [period, setPeriod] = useState<Period>("monthly");

  return (
    <div className="flex flex-col gap-6">
      {showPeriods ? (
        <div role="group" aria-label="Période de facturation" className="flex flex-wrap gap-2">
          {PERIODS.map((entry) => (
            <Button
              key={entry.value}
              size="lg"
              variant={period === entry.value ? "primary" : "secondary"}
              aria-pressed={period === entry.value}
              onClick={() => { setPeriod(entry.value); }}
              className="min-h-11 px-5"
            >
              {entry.label}
            </Button>
          ))}
        </div>
      ) : null}
      <ul className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const price = priceOf(plan, period);
          return (
            <li key={plan.id} className={cx("flex min-w-0 flex-col gap-3 rounded-lg border-2 bg-surface p-6", plan.highlight ? "border-accent" : "border-line")}>
              <h3 className="text-empty-title text-fg">{plan.name}</h3>
              <p className="text-value text-fg [overflow-wrap:anywhere]">
                {price.text}
                {price.unit ? <span className="ml-1.5 text-body text-fg-muted">{price.unit}</span> : null}
              </p>
              <p className="text-prose text-fg-muted">{plan.description}</p>
              <div className="mt-auto pt-2">
                <LinkButton href="/contact" variant={plan.highlight ? "primary" : "secondary"}>
                  {plan.cta}
                </LinkButton>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
