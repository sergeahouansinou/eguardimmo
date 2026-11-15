'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, cx } from '@eguardimmo/ui';

export interface DropZoneProps {
  title: string;
  hint: string;
  buttonLabel: string;
  inputLabel: string;
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
}

export function DropZone({ title, hint, buttonLabel, inputLabel, accept, multiple = true, onFiles }: DropZoneProps) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const handlerRef = useRef(onFiles);
  const [over, setOver] = useState(false);

  useEffect(() => {
    handlerRef.current = onFiles;
  }, [onFiles]);

  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    const enter = (event: DragEvent) => {
      event.preventDefault();
      setOver(true);
    };
    const leave = (event: DragEvent) => {
      event.preventDefault();
      setOver(false);
    };
    const drop = (event: DragEvent) => {
      event.preventDefault();
      setOver(false);
      handlerRef.current(Array.from(event.dataTransfer?.files ?? []));
    };
    zone.addEventListener('dragenter', enter);
    zone.addEventListener('dragover', enter);
    zone.addEventListener('dragleave', leave);
    zone.addEventListener('drop', drop);
    return () => {
      zone.removeEventListener('dragenter', enter);
      zone.removeEventListener('dragover', enter);
      zone.removeEventListener('dragleave', leave);
      zone.removeEventListener('drop', drop);
    };
  }, []);

  return (
    <div
      ref={zoneRef}
      role="group"
      aria-label={title}
      data-testid="zone-depot"
      className={cx(
        'flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed p-4 text-center',
        over ? 'border-action bg-action-subtle' : 'border-line-control',
      )}
    >
      <span className="text-block-title text-fg">{title}</span>
      <span className="text-caption text-fg-subtle">{hint}</span>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          inputRef.current?.click();
        }}
      >
        {buttonLabel}
      </Button>
      <input
        ref={inputRef}
        type="file"
        hidden
        aria-label={inputLabel}
        accept={accept}
        multiple={multiple}
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />
    </div>
  );
}
