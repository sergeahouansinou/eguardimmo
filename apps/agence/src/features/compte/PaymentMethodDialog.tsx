import { Alert } from "@eguardimmo/ui";
import { useState } from "react";
import { ActionDialog, useNotify } from "@/features/kit";
import { messageOf } from "@/features/shared/errors";
import { useAddPaymentMethod } from "./hooks";

const TEXTS = {
  card: { title: "Ajouter une carte bancaire", what: "votre carte bancaire" },
  sepa: { title: "Ajouter un mandat de prélèvement SEPA", what: "votre mandat de prélèvement SEPA" },
} as const;

export function PaymentMethodDialog({ kind, onClose }: { kind: "card" | "sepa"; onClose: () => void }) {
  const notify = useNotify();
  const add = useAddPaymentMethod();
  const [error, setError] = useState<string | null>(null);
  const texts = TEXTS[kind];

  const confirm = async () => {
    setError(null);
    try {
      await add.mutateAsync({ kind });
      notify.success("Moyen de paiement ajouté");
      onClose();
    } catch (failure) {
      setError(messageOf(failure));
    }
  };

  return (
    <ActionDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={texts.title}
      description={`Vous allez être redirigé vers notre prestataire de paiement sécurisé pour saisir ${texts.what}.`}
      confirmLabel="Continuer vers le prestataire"
      loading={add.isPending}
      error={error}
      onConfirm={() => void confirm()}
    >
      <Alert tone="info">eGuardImmo ne voit et ne conserve jamais votre numéro de carte ni votre IBAN. Seul un repère masqué est affiché ici.</Alert>
    </ActionDialog>
  );
}
