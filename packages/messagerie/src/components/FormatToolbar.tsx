'use client';

import { Bold, Italic, Underline } from 'lucide-react';
import type { RefObject } from 'react';
import { IconButton } from '@eguardimmo/ui';
import { toggleFormat } from '../lib/richText';
import type { RichKind } from '../lib/richText';

const ACTIONS: { kind: RichKind; label: string; icon: typeof Bold }[] = [
  { kind: 'bold', label: 'Gras', icon: Bold },
  { kind: 'italic', label: 'Italique', icon: Italic },
  { kind: 'underline', label: 'Souligné', icon: Underline },
];

export interface FormatToolbarProps {
  fieldRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function FormatToolbar({ fieldRef, value, onChange, disabled = false }: FormatToolbarProps) {
  const apply = (kind: RichKind) => {
    const field = fieldRef.current;
    const start = field?.selectionStart ?? value.length;
    const end = field?.selectionEnd ?? value.length;
    const edit = toggleFormat(value, start, end, kind);
    onChange(edit.value);
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(edit.selectionStart, edit.selectionEnd);
    });
  };
  return (
    <div role="toolbar" aria-label="Mise en forme" className="flex items-center gap-0.5">
      {ACTIONS.map(({ kind, label, icon }) => (
        <IconButton key={kind} label={label} icon={icon} size="sm" disabled={disabled} onClick={() => { apply(kind); }} />
      ))}
    </div>
  );
}
