'use client';

import { Upload } from 'lucide-react';
import { Button, Icon } from '@eguardimmo/ui';
import { useId, useRef, useState } from 'react';

export function FileDrop({
  title,
  hint,
  accept,
  allowedTypes,
  maxBytes,
  fileName,
  onFile,
  error,
}: {
  title: string;
  hint: string;
  accept: string;
  allowedTypes: readonly string[];
  maxBytes: number;
  fileName: string;
  onFile: (name: string) => void;
  error?: string;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const shown = problem ?? error;

  return (
    <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-line-control px-4 py-5 text-center">
      <Icon icon={Upload} size={20} className="text-fg-subtle" />
      <label htmlFor={inputId} className="text-body-strong text-fg">
        {title}
      </label>
      <span className="text-caption text-fg-subtle">{hint}</span>
      <input
        ref={input}
        id={inputId}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (!allowedTypes.some((type) => (type.endsWith('/*') ? file.type.startsWith(type.slice(0, -1)) : file.type === type))) {
            setProblem('Ce type de fichier n’est pas accepté.');
            return;
          }
          if (file.size > maxBytes) {
            setProblem(`Le fichier dépasse ${String(Math.round(maxBytes / 1_048_576))} Mo.`);
            return;
          }
          setProblem(null);
          onFile(file.name);
        }}
      />
      <Button variant="secondary" size="sm" onClick={() => { input.current?.click(); }}>
        Choisir un fichier
      </Button>
      {fileName ? <span className="text-caption font-medium text-fg">{`Fichier choisi : ${fileName}`}</span> : null}
      {shown ? <span role="alert" className="text-caption text-fg-danger">{shown}</span> : null}
    </div>
  );
}
