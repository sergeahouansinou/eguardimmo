'use client';

import { MailCheck } from 'lucide-react';
import { Alert, Button, Icon } from '@eguardimmo/ui';

export type CampaignTestFeedbackState = { kind: 'success'; to: string } | { kind: 'error'; message: string } | null;

export function CampaignTestButton({ pending, disabled, onClick }: { pending: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <Button variant="secondary" loading={pending} disabled={disabled} onClick={onClick}>
      <Icon icon={MailCheck} />
      Recevoir un test
    </Button>
  );
}

export function CampaignTestFeedback({ state }: { state: CampaignTestFeedbackState }) {
  if (!state) return null;
  if (state.kind === 'success') {
    return <Alert tone="success" title={`Test envoyé à ${state.to}`}>Les variables sont remplacées par des valeurs d’exemple.</Alert>;
  }
  return <Alert tone="danger" title="Envoi du test impossible">{state.message}</Alert>;
}
