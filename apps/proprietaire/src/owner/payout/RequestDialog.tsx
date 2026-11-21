"use client";

import { Button, TextField } from "@eguardimmo/ui";
import { useState } from "react";
import { ActionFailure } from "../security/ActionFailure";
import { ActionDialog } from "../shared/ActionDialog";
import type { PayoutAccount } from "./model";
import { useCreatePayoutRequest } from "./queries";
import { HOLDER_MAX, validateDraft } from "./validation";
import type { DraftProblems, RequestDraft } from "./validation";
import { PROOF_TYPES } from "./labels";

interface Props {
  account: PayoutAccount;
  onClose: () => void;
  onDone: () => void;
  onCloseAutoFocus: (event: Event) => void;
}

const EMPTY: RequestDraft = { iban: "", bic: "", holderName: "", proof: null };

export function RequestDialog({ account, onClose, onDone, onCloseAutoFocus }: Props) {
  const mutation = useCreatePayoutRequest();
  const [draft, setDraft] = useState<RequestDraft>(EMPTY);
  const [problems, setProblems] = useState<DraftProblems>({});
  const [revealed, setRevealed] = useState(false);

  const change = (patch: Partial<RequestDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const submit = () => {
    const found = validateDraft(draft);
    setProblems(found);
    if (Object.keys(found).length > 0 || draft.proof === null) return;
    mutation.mutate(
      { accessId: account.accessId, iban: draft.iban, bic: draft.bic === "" ? null : draft.bic, holderName: draft.holderName, proof: draft.proof },
      {
        onSuccess: () => {
          setDraft(EMPTY);
          onDone();
        },
      },
    );
  };

  return (
    <ActionDialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
      title="Demander un changement de compte de paiement"
      description={`${account.agencyName ?? "Votre agence"} · ${account.mandantName}. Un code vous sera envoyé par e-mail, puis votre agence vérifiera la demande avant d’activer le nouveau compte.`}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <form
        className="flex flex-col gap-3"
        noValidate
        autoComplete="off"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="flex flex-col items-start gap-2">
          <div className="w-full min-w-0">
            <TextField
              label="IBAN"
              placeholder="Saisissez l’IBAN"
              type={revealed ? "text" : "password"}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={draft.iban}
              error={problems.iban}
              data-autofocus
              onChange={(event) => {
                change({ iban: event.target.value });
              }}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            aria-pressed={revealed}
            onClick={() => {
              setRevealed((value) => !value);
            }}
          >
            {revealed ? "Masquer l’IBAN" : "Afficher l’IBAN"}
          </Button>
        </div>
        <TextField
          label="BIC (facultatif)"
          placeholder="Ex. : BNPAFRPP"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={draft.bic}
          error={problems.bic}
          onChange={(event) => {
            change({ bic: event.target.value });
          }}
        />
        <TextField
          label="Titulaire du compte"
          placeholder="Nom figurant sur le RIB"
          autoComplete="off"
          maxLength={HOLDER_MAX}
          value={draft.holderName}
          error={problems.holderName}
          onChange={(event) => {
            change({ holderName: event.target.value });
          }}
        />
        <TextField
          label="Justificatif (RIB)"
          placeholder="Choisissez un fichier"
          type="file"
          accept={PROOF_TYPES.join(",")}
          hint="PDF, JPEG ou PNG, 5 Mo au maximum."
          error={problems.proof}
          className="h-auto py-1"
          onChange={(event) => {
            change({ proof: event.target.files?.[0] ?? null });
          }}
        />
        {mutation.isError ? <ActionFailure error={mutation.error} title="Votre demande n’a pas été enregistrée" /> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" disabled={mutation.isPending} onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Envoyer la demande
          </Button>
        </div>
      </form>
    </ActionDialog>
  );
}
