import { previewText } from '../mergeFields';
import type { CampaignAudienceKind } from '../model';

export interface PreviewProps {
  subject: string;
  body: string;
  audience: CampaignAudienceKind;
  senderName: string | null;
}

export function Preview({ subject, body, audience, senderName }: PreviewProps) {
  return (
    <section aria-label="Aperçu" className="flex min-w-0 flex-col gap-2 rounded-md border border-line bg-muted p-3">
      <span className="text-caption text-fg-subtle">Aperçu avec des valeurs d’exemple{senderName ? ` · Expéditeur : ${senderName}` : ''}</span>
      <p className="text-body font-semibold break-words text-fg">{previewText(subject, audience) || 'Objet de la campagne'}</p>
      <p className="text-body break-words whitespace-pre-wrap text-fg">{previewText(body, audience) || 'Le message apparaîtra ici.'}</p>
    </section>
  );
}
