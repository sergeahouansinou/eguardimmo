'use client';

import { useRef, useState } from 'react';
import { Button } from '@eguardimmo/ui';
import { SettingRow } from '../shared/SettingRow';

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED = ['image/png', 'image/jpeg'];

export function FileRow({
  title,
  hint,
  name,
  inputLabel,
  onChange,
}: {
  title: string;
  hint: string;
  name: string;
  inputLabel: string;
  onChange: (name: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <SettingRow title={title} hint={error ?? hint}>
      <span className="truncate text-caption text-fg-subtle">{name}</span>
      <input
        ref={input}
        type="file"
        accept=".png,.jpg,.jpeg,image/png,image/jpeg"
        aria-label={inputLabel}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          if (!ACCEPTED.includes(file.type)) {
            setError('Format refusé : PNG ou JPG uniquement.');
            return;
          }
          if (file.size > MAX_BYTES) {
            setError('Fichier trop lourd : 2 Mo maximum.');
            return;
          }
          setError(null);
          onChange(file.name);
        }}
      />
      <Button variant="secondary" size="sm" onClick={() => { input.current?.click(); }}>
        Remplacer
      </Button>
    </SettingRow>
  );
}
