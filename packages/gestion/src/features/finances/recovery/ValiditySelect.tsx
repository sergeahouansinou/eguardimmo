'use client';

import { Select } from '@eguardimmo/ui';
import { DEFAULT_VALID_DAYS } from './model';
import { VALIDITY_CHOICES } from './schemas';

export { DEFAULT_VALID_DAYS };

const options = VALIDITY_CHOICES.map((days) => ({ value: String(days), label: `${String(days)} ${days > 1 ? 'jours' : 'jour'}` }));

export function ValiditySelect({ value, error, onChange }: { value: string; error?: string; onChange: (value: string) => void }) {
  return <Select label="Validité du lien" placeholder="Choisir une durée" hint="7 jours par défaut, 30 jours au plus." options={options} value={value} error={error} onValueChange={onChange} />;
}
