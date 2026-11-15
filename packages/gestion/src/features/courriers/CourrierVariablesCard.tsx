'use client';

import { Alert, Button, Card, CardTitle, TextField } from '@eguardimmo/ui';
import { amountDueError } from './courrierVariables';
import type { CourrierVariables } from './courrierVariables';

export function CourrierVariablesCard({
  variables,
  stale,
  onChange,
  onReinsert,
}: {
  variables: CourrierVariables;
  stale: boolean;
  onChange: (variables: CourrierVariables) => void;
  onReinsert: () => void;
}) {
  return (
    <Card className="gap-3" role="group" aria-labelledby="cf-variables">
      <CardTitle as="h2" id="cf-variables">Variables du courrier</CardTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField
          label="Montant dû, €"
          placeholder="Ex. 850 ou 850,50"
          inputMode="decimal"
          value={variables.amountDue}
          error={amountDueError(variables.amountDue)}
          onChange={(event) => { onChange({ ...variables, amountDue: event.target.value }); }}
        />
        <TextField
          label="Date limite de paiement"
          type="date"
          placeholder="jj/mm/aaaa"
          value={variables.dueDate}
          onChange={(event) => { onChange({ ...variables, dueDate: event.target.value }); }}
        />
      </div>
      <p className="text-caption text-fg-subtle">Insérés à la place de {'{montant_impaye}'} et {'{date_limite}'} tant que vous n’avez pas modifié le message à la main.</p>
      {stale ? (
        <Alert tone="warning" title="Message modifié à la main">
          <span className="flex flex-col items-start gap-2">
            Le montant et la date limite n’ont pas été appliqués pour ne pas écraser votre texte.
            <Button variant="secondary" size="sm" onClick={onReinsert}>Réinsérer les variables</Button>
          </span>
        </Alert>
      ) : null}
    </Card>
  );
}
