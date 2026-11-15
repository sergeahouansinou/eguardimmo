'use client';

import { Button, Card, CardTitle } from '@eguardimmo/ui';
import { useState } from 'react';
import { useCourriers } from './hooks';
import { TEMPLATE_FIELDS } from './schemas';
import { DescriptionList, SearchInput } from '../locataires/kit';
import { fold } from '../locataires/kit/useListView';
import { formatDateFr } from '../locataires/kit/dates';

export function ModeleFieldsCard({ onInsert }: { onInsert: (key: string) => void }) {
  const [query, setQuery] = useState('');
  const needle = fold(query.trim());
  const fields = TEMPLATE_FIELDS.filter((field) => needle === '' || fold(`${field.key} ${field.label}`).includes(needle));
  return (
    <Card className="gap-2" role="group" aria-labelledby="mf-champs">
      <div className="flex items-center justify-between gap-2">
        <CardTitle as="h2" id="mf-champs">Champs disponibles</CardTitle>
        <span className="text-caption text-fg-subtle">{String(TEMPLATE_FIELDS.length)}</span>
      </div>
      <SearchInput label="Chercher un champ" placeholder="Ex. loyer, échéance" value={query} onValueChange={setQuery} />
      <ul className="flex flex-col">
        {fields.map((field) => (
          <li key={field.key} className="flex flex-wrap items-center justify-between gap-x-2 border-t border-line py-1 first:border-t-0">
            <Button variant="ghost" size="sm" aria-label={`Insérer ${field.label}`} onClick={() => { onInsert(field.key); }}>
              <code className="font-mono">{`{${field.key}}`}</code>
            </Button>
            <span className="text-caption text-fg-subtle">{field.label}</span>
          </li>
        ))}
      </ul>
      {fields.length === 0 ? <p className="text-caption text-fg-subtle">Aucun champ ne correspond.</p> : null}
      <p className="text-caption text-fg-subtle">Cliquez sur un champ pour l’insérer à la place du curseur.</p>
    </Card>
  );
}

export function ModeleUsageCard({ templateId }: { templateId: string }) {
  const courriers = useCourriers();
  const used = (courriers.data ?? []).filter((item) => item.templateId === templateId);
  const sent = used.filter((item) => item.sentOn !== null);
  const last = sent.map((item) => item.sentOn ?? '').sort().at(-1) ?? null;
  return (
    <Card className="gap-2" role="group" aria-labelledby="mf-usage">
      <CardTitle as="h2" id="mf-usage">Utilisation</CardTitle>
      <DescriptionList
        termWidth="140px"
        items={[
          { term: 'Courriers créés', detail: String(used.length) },
          { term: 'Courriers envoyés', detail: String(sent.length) },
          { term: 'Dernier envoi', detail: formatDateFr(last) },
        ]}
      />
    </Card>
  );
}
