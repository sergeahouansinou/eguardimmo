import { Icon } from '@eguardimmo/ui';
import { Bell } from 'lucide-react';

export function PushPreview({ title, body, link }: { title: string; body: string; link: string }) {
  return (
    <figure aria-label="Aperçu de la notification" className="flex max-w-sm flex-col gap-1">
      <figcaption className="text-body-strong">Aperçu</figcaption>
      <div className="flex items-start gap-3 rounded-lg border border-line bg-muted p-3">
        <Icon icon={Bell} size={20} className="mt-0.5 shrink-0 text-fg-subtle" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-body-strong break-words">{title === '' ? 'Titre de la notification' : title}</span>
          <span className="text-body break-words whitespace-pre-line">{body === '' ? 'Message de la notification' : body}</span>
          {link === '' ? null : <span className="mt-1 text-caption break-all text-fg-subtle">Ouvre {link}</span>}
        </div>
      </div>
    </figure>
  );
}
