import { Alert, Button, Card, CardHeader, CardTitle, ProgressBar } from "@eguardimmo/ui";
import { formatDate } from "@/features/shared/dates";
import { formatMoney, formatMoneyExact } from "@/features/shared/money";
import type { SubscriptionView } from "./subscriptionSchemas";

export function TrialCard({ subscription, onAddPayment }: { subscription: SubscriptionView; onAddPayment: () => void }) {
  const { trial, firstCharge, paymentMethods } = subscription;
  const hasMethod = paymentMethods.length > 0;
  const charge = `Premier prélèvement : ${formatMoneyExact(firstCharge.amountMinor)} HT le ${formatDate(firstCharge.date)}.`;
  return (
    <Card role="region" aria-label="Essai gratuit">
      <CardHeader>
        <CardTitle as="h2">Essai gratuit</CardTitle>
      </CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-col">
          <b className="text-body-strong text-fg">{`Formule ${subscription.planName}, essai d'un mois`}</b>
          <span className="text-caption text-fg-subtle">{`Du ${formatDate(trial.startDate)} au ${formatDate(trial.endDate)} · ${String(trial.daysLeft)} jours restants`}</span>
        </div>
        <span className="text-block-title text-fg">
          {formatMoney(0)} <small className="text-caption font-normal text-fg-subtle">pendant l'essai</small>
        </span>
      </div>
      <ProgressBar value={(trial.elapsedDays / trial.totalDays) * 100} label={`${String(trial.elapsedDays)} jours sur ${String(trial.totalDays)} écoulés`} />
      {hasMethod ? (
        <Alert tone="success" title="Moyen de paiement enregistré">
          {`${paymentMethods.map((method) => method.label).join(", ")}. ${charge}`}
        </Alert>
      ) : (
        <Alert tone="warning" title="Aucun moyen de paiement enregistré">
          <span className="flex flex-wrap items-center justify-between gap-2">
            {`Ajoutez-en un avant le ${formatDate(trial.endDate)} pour poursuivre après l'essai. ${charge}`}
            <Button variant="secondary" size="sm" onClick={onAddPayment}>
              Ajouter un moyen de paiement
            </Button>
          </span>
        </Alert>
      )}
    </Card>
  );
}
