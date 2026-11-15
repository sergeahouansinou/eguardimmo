'use client';

import { FileArchive } from 'lucide-react';
import { useState } from 'react';
import { Alert, Button, Card, CardHeader, CardTitle, Icon, Select } from '@eguardimmo/ui';
import { Checkbox, Segmented, pushFlash } from '../../outils/kit';
import { narrow } from '../shared/narrow';
import {
  EXPORT_FORMATS,
  EXPORT_FORMAT_LABELS,
  EXPORT_PERIODS,
  EXPORT_PERIOD_LABELS,
  EXPORT_SCOPES,
  EXPORT_SCOPE_LABELS,
  exportRequestInputSchema,
} from './schemas';
import type { ExportRequestInput, ExportScope } from './schemas';
import { useRequestExport } from './source';

const INITIAL: ExportRequestInput = { scopes: ['biens', 'locataires', 'baux'], format: 'csv', period: 'all' };

const FORMAT_OPTIONS = EXPORT_FORMATS.map((value) => ({ value, label: EXPORT_FORMAT_LABELS[value] }));
const PERIOD_OPTIONS = EXPORT_PERIODS.map((value) => ({ value, label: EXPORT_PERIOD_LABELS[value] }));

export function ExportRequestCard() {
  const [input, setInput] = useState<ExportRequestInput>(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const request = useRequestExport();

  const toggle = (scope: ExportScope, checked: boolean) => {
    setError(null);
    setInput((previous) => ({
      ...previous,
      scopes: checked ? EXPORT_SCOPES.filter((item) => item === scope || previous.scopes.includes(item)) : previous.scopes.filter((item) => item !== scope),
    }));
  };

  const submit = () => {
    const parsed = exportRequestInputSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Demande invalide');
      return;
    }
    setError(null);
    request.mutate(parsed.data, {
      onSuccess: () => { pushFlash('Demande d’export enregistrée. L’archive est en préparation.'); },
    });
  };

  return (
    <Card role="region" aria-labelledby="export-demande" className="px-4 py-3">
      <CardHeader>
        <CardTitle as="h2" id="export-demande">Nouvelle demande</CardTitle>
      </CardHeader>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          submit();
        }}
      >
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-1 text-body font-medium text-fg">Données à exporter</legend>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {EXPORT_SCOPES.map((scope) => (
              <li key={scope} className="flex min-w-0 flex-col gap-0.5 rounded-md border border-line px-3 py-2">
                <Checkbox
                  label={EXPORT_SCOPE_LABELS[scope].label}
                  checked={input.scopes.includes(scope)}
                  onCheckedChange={(checked) => { toggle(scope, checked); }}
                />
                <span className="pl-6 text-caption text-fg-subtle">{EXPORT_SCOPE_LABELS[scope].detail}</span>
              </li>
            ))}
          </ul>
        </fieldset>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-body font-medium text-fg">Format</span>
            <Segmented
              label="Format du fichier"
              options={FORMAT_OPTIONS}
              value={input.format}
              onValueChange={(format) => { setInput((previous) => ({ ...previous, format })); }}
            />
          </div>
          <div className="w-full sm:w-[220px]">
            <Select
              label="Période"
              placeholder="Choisir une période"
              options={PERIOD_OPTIONS}
              value={input.period}
              onValueChange={(value) => {
                const period = narrow(EXPORT_PERIODS, value);
                if (period) setInput((previous) => ({ ...previous, period }));
              }}
            />
          </div>
        </div>
        {error ? <Alert tone="danger" title="Demande impossible">{error}</Alert> : null}
        {request.isError ? (
          <Alert tone="danger" title="La demande n’a pas pu être enregistrée">Réessayez dans un instant.</Alert>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-caption text-fg-subtle">
            L’archive reste disponible 14 jours. Chaque demande et chaque téléchargement sont inscrits au journal d’activité.
          </p>
          <Button type="submit" loading={request.isPending}>
            <Icon icon={FileArchive} />
            Demander l’export
          </Button>
        </div>
      </form>
    </Card>
  );
}
