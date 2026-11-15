'use client';

import { Alert, Button, Card, CardTitle, IconButton } from '@eguardimmo/ui';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useBiensEnvironment } from '../environment';
import { FilePicker } from './FilePicker';

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardTitle as="h2">{title}</CardTitle>
      {description ? <p className="text-body text-fg-muted">{description}</p> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

export function FullRow({ children }: { children: ReactNode }) {
  return <div className="sm:col-span-2">{children}</div>;
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Alert tone="danger" title="L’enregistrement a échoué">
      {message}
    </Alert>
  );
}

export function FormActions({
  cancelHref,
  submitLabel,
  pending,
  extra,
}: {
  cancelHref: string;
  submitLabel: string;
  pending: boolean;
  extra?: ReactNode;
}) {
  const { Link } = useBiensEnvironment();
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button variant="ghost" asChild>
        <Link href={cancelHref}>Annuler</Link>
      </Button>
      {extra}
      <Button type="submit" loading={pending}>
        {submitLabel}
      </Button>
    </div>
  );
}

export function PhotoField({ names, onChange }: { names: readonly string[]; onChange: (names: string[]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <FilePicker
        label="Déposer les photos ici"
        hint="JPG ou PNG, 10 Mo au maximum"
        accept={['image/jpeg', 'image/png', '.jpg', '.jpeg', '.png']}
        multiple
        onPick={(files) => { onChange([...new Set([...names, ...files.map((file) => file.name)])]); }}
      />
      {names.length > 0 ? (
        <ul aria-label="Photos ajoutées" className="flex flex-wrap gap-2">
          {names.map((name) => (
            <li key={name} className="flex items-center gap-1 rounded-sm bg-muted py-0.5 pr-0.5 pl-2 text-caption text-fg-muted">
              {name}
              <IconButton label={`Retirer ${name}`} icon={X} size="xs" onClick={() => { onChange(names.filter((entry) => entry !== name)); }} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
