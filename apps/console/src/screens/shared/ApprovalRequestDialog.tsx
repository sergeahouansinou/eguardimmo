'use client';

import { Alert, Button, Dialog, DialogClose, DialogContent, Textarea, TextField, useToast } from '@eguardimmo/ui';
import { useState } from 'react';
import type { ReactNode, SubmitEvent } from 'react';
import { usePlatformMutation } from '@/platform/context';
import { problemText } from '@/platform/errors';
import type { ApprovalAction } from '@/platform/approvals/approvals';
import { validateApprovalForm } from './approvalForm';
import type { ApprovalFormErrors } from './approvalForm';

export interface ApprovalRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  action: ApprovalAction;
  subjectId: string;
  submitLabel: string;
  tone?: 'primary' | 'danger';
  payload?: Record<string, string>;
  beforeSubmit?: () => boolean;
  onRequested?: () => void;
  children?: ReactNode;
}

function Body({ onOpenChange, action, subjectId, submitLabel, tone = 'primary', payload, beforeSubmit, onRequested, children }: Omit<ApprovalRequestDialogProps, 'open' | 'title' | 'description'>) {
  const { show } = useToast();
  const [reason, setReason] = useState('');
  const [ticketReference, setTicketReference] = useState('');
  const [errors, setErrors] = useState<ApprovalFormErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const request = usePlatformMutation((api, input: { reason: string; ticketReference: string }) =>
    api.approvals.request({ action, subjectId, reason: input.reason, ticketReference: input.ticketReference, payload }),
  );

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setFailure(null);
    if (beforeSubmit && !beforeSubmit()) return;
    const checked = validateApprovalForm({ reason, ticketReference });
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setErrors({});
    request.mutate(checked, {
      onSuccess: () => {
        show({ tone: 'success', title: 'Demande déposée', description: 'Elle attend la validation d’un second opérateur.' });
        onRequested?.();
        onOpenChange(false);
      },
      onError: (error) => { setFailure(problemText(error)); },
    });
  };

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3 px-4 pt-3 pb-4">
      {children}
      <Textarea
        label="Motif"
        placeholder="Décrivez pourquoi cette action est nécessaire"
        value={reason}
        error={errors.reason}
        hint="Visible par le second opérateur ; jamais copié dans le journal d’audit."
        onChange={(event) => { setReason(event.target.value); }}
        data-autofocus
      />
      <TextField
        label="Référence de ticket (facultatif)"
        placeholder="SUP-2026-00012"
        value={ticketReference}
        error={errors.ticketReference}
        autoComplete="off"
        onChange={(event) => { setTicketReference(event.target.value); }}
      />
      {failure ? <Alert tone="danger">{failure}</Alert> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button type="button" variant="secondary">
            Annuler
          </Button>
        </DialogClose>
        <Button type="submit" variant={tone === 'danger' ? 'danger' : 'primary'} loading={request.isPending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function ApprovalRequestDialog({ open, onOpenChange, title, description, ...body }: ApprovalRequestDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description}>
        <Body {...body} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}
