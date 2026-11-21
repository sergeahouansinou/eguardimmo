'use client';

import { Button } from '@eguardimmo/ui';
import { useState } from 'react';
import { formatAmountInput } from '../../format/money';
import type { Money } from '../investments/model';

export function CopyAmount({ value, label }: { value: Money; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = () => {
    const text = formatAmountInput(value.amount, value.currency);
    const write = globalThis.navigator.clipboard.writeText(text);
    write.then(
      () => { setState('copied'); },
      () => { setState('failed'); },
    );
  };
  return (
    <span className="inline-flex items-center gap-1">
      <Button variant="ghost" size="sm" aria-label={`Copier le montant : ${label}`} onClick={copy}>
        Copier
      </Button>
      <span role="status" className="text-caption text-fg-subtle">
        {state === 'copied' ? 'Copié' : state === 'failed' ? 'Copie impossible' : ''}
      </span>
    </span>
  );
}
