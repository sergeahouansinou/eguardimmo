'use client';

import { useState } from 'react';
import { pushFlash, useSourceMutation } from '../../outils/kit';
import { AssignDialog, NotifyDialog, QuoteDialog } from './InterventionDialogs';
import { useIntervenantNames } from './hooks';
import type { Intervention, QuoteInput } from './schemas';
import { INTERVENTIONS_KEY, useInterventionsSource } from './source';

export type DialogKind = 'assign' | 'notify' | 'quote';
export interface DialogState {
  kind: DialogKind;
  item: Intervention;
}

const FAILURE = 'Réessayez dans un instant.';

export function InterventionDialogHost({ state, onClose }: { state: DialogState | null; onClose: () => void }) {
  const source = useInterventionsSource();
  const names = useIntervenantNames([state?.item.intervenant ?? null]);
  const [error, setError] = useState<string | null>(null);
  const invalidate = [INTERVENTIONS_KEY] as const;
  const assign = useSourceMutation((input: { id: string; intervenant: string | null }) => source.assign(input.id, input.intervenant), invalidate);
  const notify = useSourceMutation((input: { id: string; message: string }) => source.notifyTenant(input.id, input.message), invalidate);
  const quote = useSourceMutation((input: { id: string; quote: QuoteInput }) => source.recordQuote(input.id, input.quote), invalidate);

  const close = () => {
    setError(null);
    onClose();
  };
  const run = (done: string) => ({
    onSuccess: () => {
      pushFlash(done);
      close();
    },
    onError: () => { setError(FAILURE); },
  });
  const item = state?.item ?? null;
  const shared = { error, onClose: close };

  return (
    <>
      <AssignDialog
        {...shared}
        item={state?.kind === 'assign' ? item : null}
        pending={assign.isPending}
        options={names}
        onSubmit={(intervenant) => {
          if (!item) return;
          assign.mutate(
            { id: item.id, intervenant },
            run(intervenant ? `« ${item.subject} » est confiée à ${intervenant}.` : `L’intervenant de « ${item.subject} » a été retiré.`),
          );
        }}
      />
      <NotifyDialog
        {...shared}
        item={state?.kind === 'notify' ? item : null}
        pending={notify.isPending}
        onSubmit={(message) => {
          if (item) notify.mutate({ id: item.id, message }, run('Message envoyé au locataire et consigné dans l’historique.'));
        }}
      />
      <QuoteDialog
        {...shared}
        item={state?.kind === 'quote' ? item : null}
        pending={quote.isPending}
        onSubmit={(value) => {
          if (item) quote.mutate({ id: item.id, quote: value }, run('Devis enregistré, à valider.'));
        }}
      />
    </>
  );
}
