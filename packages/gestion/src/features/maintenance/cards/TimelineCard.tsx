import { Badge, Button, Checkbox, Textarea } from '@eguardimmo/ui';
import { useState } from 'react';
import { NoRows, SectionCard } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { useSubmission } from '../dialogs/common';
import { useMaintenanceMutation } from '../hooks';
import { actorLabel, eventText } from '../labels';
import type { InterventionDetail } from '../model';

export function TimelineCard({ intervention, canComment }: { intervention: InterventionDetail; canComment: boolean }) {
  const comment = useMaintenanceMutation((source, input: Parameters<typeof source.comment>[1]) => source.comment(intervention.id, input));
  const submission = useSubmission();
  const [text, setText] = useState('');
  const [visibleToTenant, setVisibleToTenant] = useState(false);
  const [visibleToOwner, setVisibleToOwner] = useState(false);
  const events = [...intervention.events].reverse();
  return (
    <SectionCard id="journal" title="Journal">
      {canComment ? (
        <form
          noValidate
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void submission.run(
              () => comment.mutateAsync({ text, visibleToTenant, visibleToOwner }),
              { title: 'Commentaire ajouté' },
              () => { setText(''); setVisibleToTenant(false); setVisibleToOwner(false); },
            );
          }}
        >
          <Textarea label="Nouveau commentaire" placeholder="Votre commentaire" maxLength={500} rows={2} value={text} error={submission.failure ?? undefined} onChange={(event) => { setText(event.target.value); }} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex flex-wrap gap-3">
              <Checkbox label="Visible par le locataire" checked={visibleToTenant} onChange={(event) => { setVisibleToTenant(event.target.checked); }} />
              <Checkbox label="Visible par le mandant" checked={visibleToOwner} onChange={(event) => { setVisibleToOwner(event.target.checked); }} />
            </span>
            <Button type="submit" size="sm" loading={submission.pending}>Commenter</Button>
          </div>
        </form>
      ) : null}
      {events.length === 0 ? <NoRows>Aucun événement.</NoRows> : null}
      <ol className="flex flex-col">
        {events.map((event) => (
          <li key={event.id} className="flex flex-col gap-0.5 border-t border-line py-2 first:border-t-0">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <b className="text-body-strong text-fg">{eventText(event.kind)}</b>
              <span className="flex items-center gap-1">
                {event.visibleToTenant ? <Badge tone="info">Locataire</Badge> : null}
                {event.visibleToOwner ? <Badge tone="success">Mandant</Badge> : null}
              </span>
            </span>
            {event.text ? <span className="text-body text-fg">{event.text}</span> : null}
            <span className="text-caption text-fg-subtle">{`${actorLabel[event.actorKind]} · ${formatDateFr(event.createdAt)}`}</span>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}
