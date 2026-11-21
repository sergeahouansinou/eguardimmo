'use client';

import { FileText, Image, Paperclip, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button, Icon, IconButton, cx } from '@eguardimmo/ui';
import {
  ACCEPTED_ATTACHMENT_EXTENSIONS,
  MAX_ATTACHMENTS,
  validateAttachment,
} from '../data/inputs';
import { formatFileSize } from '../lib/dates';

export interface AttachmentChipProps {
  name: string;
  sizeBytes: number;
  mimeType: string;
  onRemove?: () => void;
  onOpen?: () => void;
  className?: string;
}

export function AttachmentChip({ name, sizeBytes, mimeType, onRemove, onOpen, className }: AttachmentChipProps) {
  const glyph = mimeType.startsWith('image/') ? Image : FileText;
  const size = formatFileSize(sizeBytes);
  return (
    <span
      className={cx(
        'inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md border border-line bg-surface py-0.5 pr-1 pl-2 text-caption text-fg',
        !onRemove && 'pr-2',
        className,
      )}
    >
      <Icon icon={glyph} size={14} className="text-fg-subtle" />
      {onOpen ? (
        <button
          type="button"
          aria-label={`Télécharger ${name}`}
          onClick={onOpen}
          className="-my-1 min-h-6 min-w-0 truncate py-1 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {name}
        </button>
      ) : (
        <span className="min-w-0 truncate">{name}</span>
      )}
      <span className="shrink-0 text-fg-subtle">{size}</span>
      {onRemove ? <IconButton label={`Retirer ${name}`} icon={X} size="xs" onClick={onRemove} /> : null}
    </span>
  );
}

export function AttachmentList({ files, onRemove }: { files: File[]; onRemove?: (index: number) => void }) {
  if (files.length === 0) return null;
  return (
    <ul aria-label="Pièces jointes" className="flex flex-wrap gap-1.5">
      {files.map((file, index) => (
        <li key={`${file.name}-${String(index)}`} className="flex max-w-full min-w-0">
          <AttachmentChip
            name={file.name}
            sizeBytes={file.size}
            mimeType={file.type}
            {...(onRemove ? { onRemove: () => { onRemove(index); } } : {})}
          />
        </li>
      ))}
    </ul>
  );
}

export interface AttachmentsState {
  files: File[];
  problem: string | null;
  add: (candidates: File[]) => void;
  remove: (index: number) => void;
  clear: () => void;
  full: boolean;
}

export function useAttachments(): AttachmentsState {
  const [files, setFiles] = useState<File[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  const add = (candidates: File[]) => {
    const problems: string[] = [];
    const accepted = candidates.filter((file) => {
      const issue = validateAttachment(file);
      if (issue) problems.push(issue);
      return issue === null;
    });
    const room = MAX_ATTACHMENTS - files.length;
    if (accepted.length > room) {
      problems.push(`${String(MAX_ATTACHMENTS)} pièces jointes au maximum.`);
    }
    setFiles([...files, ...accepted.slice(0, Math.max(room, 0))]);
    setProblem(problems.length > 0 ? problems.join(' ') : null);
  };

  return {
    files,
    problem,
    add,
    remove: (index) => {
      setFiles(files.filter((_, position) => position !== index));
      setProblem(null);
    },
    clear: () => {
      setFiles([]);
      setProblem(null);
    },
    full: files.length >= MAX_ATTACHMENTS,
  };
}

export interface AttachmentPickerProps {
  attachments: AttachmentsState;
  variant: 'icon' | 'zone';
  disabled?: boolean;
}

export function AttachmentPicker({ attachments, variant, disabled = false }: AttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const open = () => inputRef.current?.click();
  const blocked = disabled || attachments.full;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        tabIndex={-1}
        aria-label="Choisir des fichiers"
        accept={ACCEPTED_ATTACHMENT_EXTENSIONS}
        onChange={(event) => {
          attachments.add(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />
      {variant === 'icon' ? (
        <IconButton label="Joindre un document" icon={Paperclip} disabled={blocked} onClick={open} />
      ) : (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-line-control bg-muted px-4 py-3">
          <span className="text-block-title text-fg">Joindre un document</span>
          <span className="text-caption text-fg-subtle">PDF ou image, 10 Mo au maximum</span>
          <Button variant="secondary" size="sm" disabled={blocked} onClick={open}>
            Choisir un fichier
          </Button>
        </div>
      )}
      {attachments.problem ? (
        <p role="alert" className="text-caption text-fg-danger">
          {attachments.problem}
        </p>
      ) : null}
    </>
  );
}
