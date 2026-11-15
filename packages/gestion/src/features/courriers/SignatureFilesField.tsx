'use client';

import { FileText, Trash2 } from 'lucide-react';
import { Icon, IconButton } from '@eguardimmo/ui';
import { MAX_SIGNATURE_FILES } from './schemas';
import { FileDrop } from '../locataires/kit';

const MAX_BYTES = 20 * 1_048_576;

export function SignatureFilesField({ files, error, onChange }: { files: readonly string[]; error?: string; onChange: (files: string[]) => void }) {
  const full = files.length >= MAX_SIGNATURE_FILES;
  return (
    <div className="flex flex-col gap-2">
      {files.length > 0 ? (
        <ul aria-label="Documents à signer" className="flex flex-col gap-1">
          {files.map((name, index) => (
            <li key={`${name}-${String(index)}`} className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-line px-2 py-1">
              <span className="flex min-w-0 items-center gap-2">
                <Icon icon={FileText} size={16} className="shrink-0 text-fg-subtle" />
                <span className="min-w-0 break-words text-body text-fg">{name}</span>
              </span>
              <IconButton label={`Retirer ${name}`} icon={Trash2} onClick={() => { onChange(files.filter((_, position) => position !== index)); }} />
            </li>
          ))}
        </ul>
      ) : null}
      {full ? (
        <span className="text-caption text-fg-subtle">{`${String(MAX_SIGNATURE_FILES)} documents au maximum par demande.`}</span>
      ) : (
        <FileDrop
          key={files.join('|')}
          title={files.length === 0 ? 'Importer le PDF à signer' : 'Ajouter un autre PDF'}
          hint="PDF uniquement, 20 Mo au maximum par fichier."
          accept="application/pdf"
          allowedTypes={['application/pdf']}
          maxBytes={MAX_BYTES}
          fileName=""
          error={error}
          onFile={(name) => { onChange([...files, name]); }}
        />
      )}
      {full && error ? <span role="alert" className="text-caption text-fg-danger">{error}</span> : null}
    </div>
  );
}
