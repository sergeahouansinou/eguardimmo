import { Button, Icon, cx } from '@eguardimmo/ui';
import { FileUp, X } from 'lucide-react';
import { useId, useRef } from 'react';
import type { UploadRules } from '@/lib/files';

export function FileDrop({
  title,
  rules,
  files,
  multiple = false,
  onFilesChange,
  error,
}: {
  title: string;
  rules: UploadRules;
  files: readonly File[];
  multiple?: boolean;
  onFilesChange: (files: File[]) => void;
  error?: string;
}) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-2">
      <div
        className={cx(
          'flex flex-col items-center gap-1.5 rounded-md border border-dashed bg-page px-4 py-5 text-center',
          error ? 'border-danger-solid' : 'border-line-strong',
        )}
      >
        <Icon icon={FileUp} size={20} className="text-fg-subtle" />
        <span className="text-block-title">{title}</span>
        <span className="text-caption text-fg-subtle">{rules.label}</span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple={multiple}
          accept={rules.mimeTypes.join(',')}
          aria-label={title}
          aria-describedby={error ? errorId : undefined}
          className="sr-only"
          onChange={(event) => {
            const selected = Array.from(event.target.files ?? []);
            event.target.value = '';
            if (selected.length > 0) onFilesChange(multiple ? [...files, ...selected] : selected.slice(0, 1));
          }}
        />
        <Button variant="secondary" size="sm" onClick={() => { inputRef.current?.click(); }}>
          Choisir un fichier
        </Button>
      </div>
      {files.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${String(index)}`}
              className="inline-flex max-w-full items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-caption text-fg-muted"
            >
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                aria-label={`Retirer ${file.name}`}
                className="rounded-sm text-fg-subtle hover:text-fg"
                onClick={() => { onFilesChange(files.filter((_, position) => position !== index)); }}
              >
                <Icon icon={X} size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-caption text-fg-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
