'use client';

import { Button, IconButton, TextField } from '@eguardimmo/ui';
import { X } from 'lucide-react';
import { useState } from 'react';
import { isEmailAddress } from '../campaignDraft';

export interface RecipientsFieldProps {
  value: readonly string[];
  max: number;
  error?: string;
  onChange: (recipients: string[]) => void;
}

function split(text: string): string[] {
  return text.split(/[\s,;]+/).filter((entry) => entry !== '');
}

export function RecipientsField({ value, max, error, onChange }: RecipientsFieldProps) {
  const [typed, setTyped] = useState('');
  const [rejected, setRejected] = useState<string | undefined>(undefined);

  const add = (text: string) => {
    const known = new Set(value.map((address) => address.toLowerCase()));
    const next = [...value];
    const invalid: string[] = [];
    const overflow: string[] = [];
    for (const entry of split(text)) {
      if (!isEmailAddress(entry)) invalid.push(entry);
      else if (!known.has(entry.toLowerCase())) {
        if (next.length >= max) overflow.push(entry);
        else {
          known.add(entry.toLowerCase());
          next.push(entry);
        }
      }
    }
    if (next.length !== value.length) onChange(next);
    setTyped([...invalid, ...overflow].join(' '));
    if (invalid.length > 0) setRejected(`Adresse non valide : ${invalid.join(', ')}`);
    else setRejected(overflow.length > 0 ? `${String(max)} adresses au maximum.` : undefined);
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <TextField
            label="Adresses e-mail des destinataires"
            placeholder="prenom.nom@exemple.fr"
            hint="Séparez plusieurs adresses par une virgule, un espace ou un retour à la ligne. Seuls les comptes existants reçoivent la campagne."
            inputMode="email"
            autoComplete="off"
            spellCheck={false}
            value={typed}
            error={rejected ?? error}
            onChange={(event) => {
              setTyped(event.target.value);
              setRejected(undefined);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              add(typed);
            }}
            onPaste={(event) => {
              const pasted = event.clipboardData.getData('text');
              if (split(pasted).length < 2) return;
              event.preventDefault();
              add(`${typed} ${pasted}`);
            }}
            onBlur={() => { if (typed.trim() !== '') add(typed); }}
          />
        </div>
        <Button variant="secondary" className="sm:mt-5" disabled={typed.trim() === ''} onClick={() => { add(typed); }}>
          Ajouter
        </Button>
      </div>
      {value.length === 0 ? null : (
        <>
          <p className="text-caption text-fg-subtle" aria-live="polite">{value.length} sur {max} adresses</p>
          <ul aria-label="Destinataires choisis" className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
            {value.map((address) => (
              <li key={address} className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-2.5 text-caption">
                <span className="min-w-0 break-all">{address}</span>
                <IconButton label={`Retirer ${address}`} icon={X} size="xs" onClick={() => { onChange(value.filter((entry) => entry !== address)); }} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
