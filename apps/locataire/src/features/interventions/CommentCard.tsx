'use client';

import { Button, Icon, Textarea } from '@eguardimmo/ui';
import { Send } from 'lucide-react';
import { useState } from 'react';
import { FailureAlert } from '@/components/FailureAlert';
import { useFlash } from '@/components/flash';
import { SectionCard } from '@/components/Section';
import { INTERVENTION_WORDING } from '@/tenant/interventionErrors';
import { useComment } from '@/tenant/interventionQueries';

const MAX_LENGTH = 500;

export function CommentCard({ id }: { id: string }) {
  const comment = useComment();
  const show = useFlash((state) => state.show);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    const trimmed = text.trim();
    const problem = trimmed === '' ? 'Écrivez votre message.' : trimmed.length > MAX_LENGTH ? `Votre message dépasse ${String(MAX_LENGTH)} caractères.` : undefined;
    setError(problem);
    if (problem !== undefined) return;
    comment.mutate(
      { id, text: trimmed },
      {
        onSuccess: () => {
          setText('');
          show({ tone: 'success', title: 'Message envoyé', detail: 'Votre gestionnaire le verra dans la chronologie.', path: `/interventions/${id}` });
        },
      },
    );
  };

  return (
    <SectionCard id="iv-message" title="Ajouter un message">
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Textarea label="Votre message" placeholder="Une précision, une disponibilité…" rows={3} maxLength={MAX_LENGTH} value={text} onChange={(event) => { setText(event.target.value); }} error={error} />
        {comment.isError ? <FailureAlert title="Le message n’a pas pu être envoyé" error={comment.error} wording={INTERVENTION_WORDING} /> : null}
        <div>
          <Button type="submit" size="sm" loading={comment.isPending}>
            <Icon icon={Send} />
            Envoyer
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}
