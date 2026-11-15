"use client";

import { Button } from "@eguardimmo/ui";
import { useId, useRef, useState } from "react";

export interface FilePickerProps {
  label: string;
  hint: string;
  accept: string;
  maxBytes: number;
  fileName: string;
  onFileName: (name: string) => void;
}

export function FilePicker({ label, hint, accept, maxBytes, fileName, onFileName }: FilePickerProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  return (
    <div className="flex flex-col items-start gap-1.5 rounded-md border border-dashed border-line-control p-3">
      <span id={`${inputId}-label`} className="text-block-title text-fg">
        {label}
      </span>
      <span className="text-caption text-fg-subtle">{hint}</span>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        aria-labelledby={`${inputId}-label`}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (file.size > maxBytes) {
            setError(`Ce fichier dépasse ${String(Math.round(maxBytes / 1_000_000))} Mo.`);
            onFileName("");
            return;
          }
          setError(undefined);
          onFileName(file.name);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => { inputRef.current?.click(); }}>
          {fileName ? "Remplacer le fichier" : "Choisir un fichier"}
        </Button>
        {fileName ? (
          <>
            <span className="text-caption text-fg [overflow-wrap:anywhere]">{fileName}</span>
            <Button variant="ghost" size="sm" onClick={() => { onFileName(""); setError(undefined); if (inputRef.current) inputRef.current.value = ""; }}>
              Retirer
            </Button>
          </>
        ) : null}
      </div>
      {error ? <p className="text-caption text-fg-danger">{error}</p> : null}
    </div>
  );
}
