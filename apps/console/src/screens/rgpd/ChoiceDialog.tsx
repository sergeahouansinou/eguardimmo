'use client';

import { RadioGroup } from '@eguardimmo/ui';
import type { RadioOption } from '@eguardimmo/ui';
import { useState } from 'react';
import type { ReactNode, SubmitEvent } from 'react';
import { FormDialog } from '@/ui/FormDialog';

export interface ChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  legend: string;
  options: readonly RadioOption[];
  submitLabel: string;
  tone?: 'primary' | 'danger';
  onChoose: (value: string) => Promise<void>;
}

function Body({ onOpenChange, title, description, legend, options, submitLabel, tone, onChoose }: Omit<ChoiceDialogProps, 'open'>) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFailure(null);
    if (value === '') {
      setError('Faites un choix pour continuer.');
      return;
    }
    setPending(true);
    try {
      await onChoose(value);
      onOpenChange(false);
    } catch (problem) {
      setFailure(problem instanceof Error ? problem.message : 'L’action a échoué. Réessayez.');
    } finally {
      setPending(false);
    }
  };

  return (
    <FormDialog open onOpenChange={onOpenChange} title={title} description={description} submitLabel={submitLabel} tone={tone} pending={pending} failure={failure} onSubmit={(event) => void submit(event)}>
      <RadioGroup label={legend} options={options} value={value} error={error} onValueChange={(next) => { setValue(next); setError(undefined); }} />
    </FormDialog>
  );
}

export function ChoiceDialog({ open, ...props }: ChoiceDialogProps) {
  return open ? <Body {...props} /> : null;
}
