import { Button, Card, CardHeader, CardTitle, Icon } from "@eguardimmo/ui";
import { CreditCard } from "lucide-react";
import { useState } from "react";
import { ActionDialog, useNotify } from "@/features/kit";
import { messageOf } from "@/features/shared/errors";
import { useRemovePaymentMethod } from "./hooks";
import { InfoRow } from "./InfoRow";
import type { PaymentMethod } from "./subscriptionSchemas";

const KINDS = [
  { kind: "card", title: "Carte bancaire", hint: "Visa, Mastercard ou CB", add: "Ajouter une carte" },
  { kind: "sepa", title: "Prélèvement SEPA", hint: "Mandat signé en ligne", add: "Ajouter un mandat" },
] as const;

export function PaymentMethodsCard({ methods, onAdd }: { methods: readonly PaymentMethod[]; onAdd: (kind: "card" | "sepa") => void }) {
  const notify = useNotify();
  const remove = useRemovePaymentMethod();
  const [target, setTarget] = useState<PaymentMethod | null>(null);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!target) return;
    setError(null);
    try {
      await remove.mutateAsync(target.id);
      notify.success("Moyen de paiement retiré", target.label);
      setTarget(null);
    } catch (failure) {
      setError(messageOf(failure));
    }
  };

  return (
    <Card role="region" aria-label="Moyens de paiement">
      <CardHeader>
        <CardTitle as="h2">Moyens de paiement</CardTitle>
      </CardHeader>
      {KINDS.map((item) => {
        const method = methods.find((candidate) => candidate.kind === item.kind);
        return (
          <InfoRow
            key={item.kind}
            title={item.title}
            hint={method ? method.label : item.hint}
            trailing={
              method ? (
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`Retirer ${method.label}`}
                  onClick={() => {
                    setError(null);
                    setTarget(method);
                  }}
                >
                  Retirer
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onAdd(item.kind);
                  }}
                >
                  {item.kind === "card" ? <Icon icon={CreditCard} /> : null}
                  {item.add}
                </Button>
              )
            }
          />
        );
      })}
      <ActionDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        tone="danger"
        title="Retirer ce moyen de paiement ?"
        description={target ? `${target.label} ne sera plus utilisé pour les prélèvements.` : ""}
        confirmLabel="Retirer"
        cancelLabel="Retour"
        loading={remove.isPending}
        error={error}
        onConfirm={() => void confirm()}
      />
    </Card>
  );
}
