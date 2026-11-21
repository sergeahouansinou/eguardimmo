'use client';

import { Paperclip, X } from 'lucide-react';
import { Button, Icon, IconButton } from '@eguardimmo/ui';
import { useId, useRef, useState } from 'react';

export interface FilePickerProps {
  label: string;
  hint: string;
  accept: string;
  validate: (file: File) => string | null;
  file: File | null;
  onFile: (file: File | null) => void;
  error?: string;
}

export function FilePicker({ label, hint, accept, validate, file, onFile, error }: FilePickerProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const shown = problem ?? error;

  const choose = (candidate: File | undefined) => {
    if (candidate === undefined) return;
    const refusal = validate(candidate);
    setProblem(refusal);
    onFile(refusal === null ? candidate : null);
  };

  const clear = () => {
    setProblem(null);
    onFile(null);
    if (input.current) input.current.value = '';
  };

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={inputId} className="text-caption text-fg-muted">{label}</label>
      <div className="flex flex-wrap items-center gap-2 rounded-sm border border-dashed border-line-control px-3 py-2">
        <input
          ref={input}
          id={inputId}
          type="file"
          accept={accept}
          className="sr-only"
          aria-invalid={shown ? true : undefined}
          aria-describedby={shown ? errorId : undefined}
          onChange={(event) => { choose(event.target.files?.[0]); }}
        />
        <Button variant="secondary" size="sm" onClick={() => { input.current?.click(); }}>
          <Icon icon={Paperclip} />
          {file ? 'Remplacer le fichier' : 'Choisir un fichier'}
        </Button>
        {file ? (
          <span className="flex min-w-0 items-center gap-1 text-caption text-fg">
            <span className="min-w-0 truncate" data-testid="file-name">{file.name}</span>
            <IconButton label="Retirer le fichier" icon={X} size="sm" onClick={clear} />
          </span>
        ) : (
          <span className="text-caption text-fg-subtle">{hint}</span>
        )}
      </div>
      {shown ? <span id={errorId} role="alert" className="text-caption text-fg-danger">{shown}</span> : null}
    </div>
  );
}
