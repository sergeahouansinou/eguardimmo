import { Icon, IconButton, cx } from "@eguardimmo/ui";
import { FileText, X } from "lucide-react";
import { useId, useState } from "react";
import { formatFileSize, validateFile } from "@/features/shared/files";
import type { FileRules } from "@/features/shared/files";

export interface FileDropProps {
  title: string;
  hint: string;
  rules: FileRules;
  file: File | null;
  onFileChange: (file: File | null) => void;
  error?: string;
  browseLabel?: string;
}

export function FileDrop({ title, hint, rules, file, onFileChange, error, browseLabel = "Parcourir" }: FileDropProps) {
  const id = useId();
  const [localError, setLocalError] = useState<string | null>(null);

  const accept = (candidate: File | undefined) => {
    if (!candidate) return;
    const problem = validateFile(candidate, rules);
    setLocalError(problem);
    onFileChange(problem ? null : candidate);
  };

  const shownError = localError ?? error;
  return (
    <div className="flex flex-col gap-2">
      <div
        className={cx(
          "relative flex flex-col items-center gap-1.5 rounded-md border border-dashed border-line-control bg-muted px-4 py-6 text-center",
          "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus",
        )}
      >
        <span className="text-body-strong text-fg">{title}</span>
        <span id={`${id}-hint`} className="text-caption text-fg-subtle">
          {hint}
        </span>
        <span aria-hidden="true" className="inline-flex h-7 items-center rounded-sm border border-line bg-surface px-2.5 text-caption font-semibold text-fg">
          {browseLabel}
        </span>
        <input
          id={id}
          type="file"
          accept={rules.extensions.map((extension) => `.${extension}`).join(",")}
          aria-label={browseLabel}
          aria-describedby={`${id}-hint`}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
          onChange={(event) => {
            accept(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
      {shownError ? <p className="text-caption text-fg-danger">{shownError}</p> : null}
      {file ? (
        <div className="flex items-center gap-2.5 rounded-md border border-line px-3 py-2">
          <Icon icon={FileText} className="text-fg-subtle" />
          <span className="flex min-w-0 flex-1 flex-col">
            <b className="truncate text-body-strong text-fg">{file.name}</b>
            <span className="text-caption text-fg-subtle">{formatFileSize(file.size)} · prêt</span>
          </span>
          <IconButton
            label={`Retirer le fichier ${file.name}`}
            icon={X}
            onClick={() => {
              setLocalError(null);
              onFileChange(null);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
