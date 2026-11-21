"use client";

import { Button, TextField } from "@eguardimmo/ui";
import { useState } from "react";
import { formatDateTime } from "../format";
import { ActionFailure } from "../security/ActionFailure";
import { CODE_ATTEMPTS } from "./labels";
import type { PayoutRequest } from "./model";
import { useConfirmPayoutRequest } from "./queries";
import { CODE_SHAPE } from "./validation";

export function CodeForm({ request, onConfirmed }: { request: PayoutRequest; onConfirmed: () => void }) {
  const mutation = useConfirmPayoutRequest(request.id);
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<string | undefined>(undefined);

  const submit = () => {
    if (!CODE_SHAPE.test(code)) {
      setProblem("Le code comporte 6 chiffres.");
      return;
    }
    setProblem(undefined);
    mutation.mutate(code, {
      onSuccess: () => {
        setCode("");
        onConfirmed();
      },
      onError: () => {
        setCode("");
      },
    });
  };

  return (
    <form
      className="flex flex-col gap-2"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <TextField
        label="Code reçu par e-mail"
        placeholder="6 chiffres"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        error={problem}
        hint={`${request.codeExpiresAt === null ? "Le code a une durée de validité limitée" : `Valable jusqu’au ${formatDateTime(request.codeExpiresAt)}`}. ${String(CODE_ATTEMPTS)} essais au total : après le troisième, la demande est abandonnée.`}
        onChange={(event) => {
          setCode(event.target.value.replace(/\D/g, ""));
        }}
      />
      {mutation.isError ? <ActionFailure error={mutation.error} title="Le code n’a pas été accepté" /> : null}
      <div>
        <Button type="submit" size="sm" loading={mutation.isPending}>
          Confirmer le code
        </Button>
      </div>
    </form>
  );
}
