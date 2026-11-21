'use client';

import { Alert, Button, Checkbox, Switch, TextField, useToast } from '@eguardimmo/ui';
import { useState } from 'react';
import type { SubmitEvent } from 'react';
import { problemText } from '@/platform/errors';
import type { PlanVersion } from '@/platform/plans/plans';
import { Section } from '@/ui/Section';
import { buildChanges, toDraftState } from './draftForm';
import type { DraftErrors, DraftState } from './draftForm';
import { GROUP_LABELS } from './labels';
import { useUpdateDraft } from './hooks';

const NO_ERRORS: DraftErrors = { prices: {}, entitlements: {} };

export interface DraftEditorProps {
  version: PlanVersion;
  onDone: () => void;
}

export function DraftEditor({ version, onDone }: DraftEditorProps) {
  const { show } = useToast();
  const [state, setState] = useState<DraftState>(() => toDraftState(version));
  const [errors, setErrors] = useState<DraftErrors>(NO_ERRORS);
  const [failure, setFailure] = useState<string | null>(null);
  const update = useUpdateDraft();

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFailure(null);
    const built = buildChanges(state);
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    setErrors(NO_ERRORS);
    update.mutate(
      { versionId: version.id, changes: built.changes },
      {
        onSuccess: () => {
          show({ tone: 'success', title: 'Brouillon enregistré', description: `La version ${String(version.version)} reste modifiable jusqu’à sa publication.` });
          onDone();
        },
        onError: (error) => { setFailure(problemText(error)); },
      },
    );
  };

  return (
    <form noValidate onSubmit={submit} aria-label={`Modifier le brouillon de la version ${String(version.version)}`} className="flex flex-col gap-3">
      <Section id="draft-general" title="Général">
        <div className="flex flex-col gap-3">
          <Switch label="Inscription publique" checked={state.publicSignup} onCheckedChange={(publicSignup) => { setState({ ...state, publicSignup }); }} />
          <p className="text-caption text-fg-subtle">L’essai est fixé à {version.trialDays} jours par la grille : il ne se modifie pas ici.</p>
        </div>
      </Section>
      <Section id="draft-prices" title="Prix (montants en unité majeure, par exemple 35 ou 35,50)">
        <div className="flex flex-col gap-3">
          {state.prices.map((price, index) => (
            <fieldset key={price.currency} className="flex flex-col gap-2 border-0 p-0">
              <legend className="mb-1 text-body font-medium">{price.currency}</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <TextField
                  label={`Mensuel en ${price.currency}`}
                  placeholder="35,50"
                  inputMode="decimal"
                  value={price.monthly}
                  error={errors.prices[price.currency]}
                  onChange={(event) => { setState({ ...state, prices: state.prices.map((p, i) => (i === index ? { ...p, monthly: event.target.value } : p)) }); }}
                />
                <TextField
                  label={`Annuel en ${price.currency}`}
                  placeholder="350"
                  inputMode="decimal"
                  value={price.yearly}
                  onChange={(event) => { setState({ ...state, prices: state.prices.map((p, i) => (i === index ? { ...p, yearly: event.target.value } : p)) }); }}
                />
              </div>
            </fieldset>
          ))}
          <p className="text-caption text-fg-subtle">Laissez les deux champs vides pour ne proposer aucun prix dans cette devise.</p>
        </div>
      </Section>
      <Section id="draft-rights" title="Droits">
        <ul className="flex flex-col gap-2">
          {state.entitlements.map((draft, index) => (
            <li key={draft.feature} className="grid grid-cols-1 items-start gap-2 border-b border-line pb-2 last:border-b-0 sm:grid-cols-[1fr_auto_12rem]">
              <span className="flex flex-col">
                <span className="text-body">{draft.label}</span>
                <span className="text-caption text-fg-subtle">{GROUP_LABELS[draft.group] ?? draft.group}</span>
              </span>
              <Checkbox
                label={`Inclure ${draft.label}`}
                checked={draft.enabled}
                onChange={(event) => { setState({ ...state, entitlements: state.entitlements.map((e, i) => (i === index ? { ...e, enabled: event.target.checked } : e)) }); }}
              />
              {draft.kind === 'quota' ? (
                <TextField
                  label={`Limite : ${draft.label}`}
                  placeholder="Illimité"
                  inputMode="numeric"
                  value={draft.limit}
                  disabled={!draft.enabled}
                  error={errors.entitlements[draft.feature]}
                  onChange={(event) => { setState({ ...state, entitlements: state.entitlements.map((e, i) => (i === index ? { ...e, limit: event.target.value } : e)) }); }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      </Section>
      {failure ? <Alert tone="danger">{failure}</Alert> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" loading={update.isPending}>
          Enregistrer le brouillon
        </Button>
      </div>
    </form>
  );
}
