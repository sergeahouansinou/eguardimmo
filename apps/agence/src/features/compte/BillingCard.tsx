import { Alert, Button, Card, CardHeader, CardTitle, Dialog, DialogClose, DialogContent, TextField } from "@eguardimmo/ui";
import { useState } from "react";
import type { SubmitEvent } from "react";
import { DetailList, DialogBody, DialogFooter, applyServerError, useNotify, useSchemaForm } from "@/features/kit";
import { useSaveBilling } from "./hooks";
import { billingInputSchema } from "./subscriptionSchemas";
import type { Billing } from "./subscriptionSchemas";

function BillingDialog({ billing, onClose }: { billing: Billing; onClose: () => void }) {
  const notify = useNotify();
  const save = useSaveBilling();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState } = useSchemaForm(billingInputSchema, billing);
  const { errors } = formState;

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await save.mutateAsync(values);
      notify.success("Facturation mise à jour");
      onClose();
    } catch (error) {
      setFormError(applyServerError(setError, error));
    }
  });

  const handleSubmitEvent = (event: SubmitEvent<HTMLFormElement>) => {
    event.stopPropagation();
    void submit(event);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent title="Modifier la facturation" description="Ces informations figurent sur vos factures eGuardImmo.">
        <form onSubmit={handleSubmitEvent} noValidate>
          <DialogBody>
            <TextField label="Société *" placeholder="Ex. : Cabinet Delmas Immobilier" error={errors.company?.message} {...register("company")} />
            <TextField label="Adresse *" placeholder="Ex. : 24 avenue de la République, 75011 Paris" error={errors.address?.message} {...register("address")} />
            <TextField label="N° de TVA *" placeholder="Ex. : FR40912345678" error={errors.vatNumber?.message} {...register("vatNumber")} />
            <TextField label="E-mail de facturation *" type="email" placeholder="Ex. : compta@agence.example" error={errors.email?.message} {...register("email")} />
            {formError ? <Alert tone="danger">{formError}</Alert> : null}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Annuler</Button>
            </DialogClose>
            <Button type="submit" loading={save.isPending}>
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BillingCard({ billing }: { billing: Billing }) {
  const [editing, setEditing] = useState(false);
  return (
    <Card role="region" aria-label="Facturation">
      <CardHeader>
        <CardTitle as="h2">Facturation</CardTitle>
      </CardHeader>
      <DetailList
        items={[
          { label: "Société", value: billing.company },
          { label: "Adresse", value: billing.address },
          { label: "N° de TVA", value: billing.vatNumber },
          { label: "E-mail", value: billing.email },
        ]}
      />
      <div>
        <Button
          variant="secondary"
          onClick={() => {
            setEditing(true);
          }}
        >
          Modifier la facturation
        </Button>
      </div>
      {editing ? (
        <BillingDialog
          billing={billing}
          onClose={() => {
            setEditing(false);
          }}
        />
      ) : null}
    </Card>
  );
}
