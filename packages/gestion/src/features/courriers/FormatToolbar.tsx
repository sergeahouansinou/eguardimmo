'use client';

import { Bold, Italic, Underline } from 'lucide-react';
import type { RefObject } from 'react';
import { IconButton } from '@eguardimmo/ui';
import { toggleFormat } from './formatting';
import type { FormatKind } from './formatting';

const ACTIONS: { kind: FormatKind; label: string; icon: typeof Bold }[] = [
  { kind: 'bold', label: 'Gras', icon: Bold },
  { kind: 'italic', label: 'Italique', icon: Italic },
  { kind: 'underline', label: 'Souligné', icon: Underline },
];

export function FormatToolbar({ fieldRef, value, onChange }: { fieldRef: RefObject<HTMLElement | null>; value: string; onChange: (value: string) => void }) {
  const apply = (kind: FormatKind) => {
    const field = fieldRef.current?.querySelector('textarea');
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
    <div role="group" aria-label="Mise en forme" className="flex items-center gap-0.5">
      {ACTIONS.map(({ kind, label, icon }) => (
        <IconButton key={kind} label={label} icon={icon} size="sm" onClick={() => { apply(kind); }} />
      ))}
    </div>
  );
}
