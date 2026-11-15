'use client';

import { Button, Icon } from '@eguardimmo/ui';
import { Upload } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { formatBytes } from '../lib/text';
import { MAX_UPLOAD_BYTES } from '../schemas/common';

export interface PickedFile {
  name: string;
  sizeBytes: number;
  file: File;
}

export interface FilePickerProps {
  label: string;
  hint: string;
  accept: readonly string[];
  multiple?: boolean;
  buttonLabel?: string;
  onPick: (files: PickedFile[]) => void;
}

function isAccepted(file: File, accept: readonly string[]): boolean {
  const name = file.name.toLowerCase();
  return accept.some((rule) => (rule.startsWith('.') ? name.endsWith(rule) : file.type === rule));
}

export function validateFiles(files: readonly File[], accept: readonly string[]): { accepted: PickedFile[]; errors: string[] } {
  const accepted: PickedFile[] = [];
  const errors: string[] = [];
  for (const file of files) {
    if (!isAccepted(file, accept)) errors.push(`« ${file.name} » : format non accepté.`);
    else if (file.size === 0) errors.push(`« ${file.name} » : le fichier est vide.`);
    else if (file.size > MAX_UPLOAD_BYTES) errors.push(`« ${file.name} » : ${formatBytes(file.size)}, 10 Mo au maximum.`);
    else accepted.push({ name: file.name, sizeBytes: file.size, file });
  }
  return { accepted, errors };
}

export function FilePicker({ label, hint, accept, multiple = false, buttonLabel, onPick }: FilePickerProps) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  const receive = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    const result = validateFiles(multiple ? files : files.slice(0, 1), accept);
    setErrors(result.errors);
    if (result.accepted.length > 0) onPick(result.accepted);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    receive(event.dataTransfer.files);
  };

  return (
    <div className="flex flex-col gap-1">
      <div
        role="presentation"
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => { setDragging(false); }}
        onDrop={onDrop}
        className={`flex flex-col items-center gap-1.5 rounded-lg border border-dashed p-4 text-center ${dragging ? 'border-focus bg-action-subtle' : 'border-line-control'}`}
      >
        <Icon icon={Upload} size={20} className="text-fg-subtle" />
        <p className="text-body font-medium text-fg">{label}</p>
        <p className="text-caption text-fg-subtle">{hint}</p>
        <input
          ref={input}
          id={inputId}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-label={label}
          accept={accept.join(',')}
          multiple={multiple}
          onChange={(event) => {
            receive(event.target.files);
            event.target.value = '';
          }}
        />
        <Button variant="secondary" size="sm" onClick={() => { input.current?.click(); }}>
          {buttonLabel ?? (multiple ? 'Choisir des fichiers' : 'Choisir un fichier')}
        </Button>
      </div>
      {errors.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-caption text-fg-danger" role="alert">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
