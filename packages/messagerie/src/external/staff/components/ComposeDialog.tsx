'use client';

import { Send } from 'lucide-react';
import { useRef, useState } from 'react';
import { Alert, Button, Dialog, DialogClose, DialogContent, Icon, Select, TextField, Textarea } from '@eguardimmo/ui';
import { FormatToolbar } from '../../../components/FormatToolbar';
import { fieldErrors } from '../../../components/formErrors';
import type { FieldErrors } from '../../../components/formErrors';
import { newMessageInputSchema } from '../../../data/inputs';
import { fingerprintOf, useSendIntent } from '../../clientId';
import { NoticeNotAFormalAct } from '../../components/parts';
import { staffSendFailureMessage } from '../api/errors';
import { useStaffConfig } from '../context';
import { staffKindCopy } from '../copy';
import type { StaffKind } from '../model';
import { useStaffOpenThread } from '../queries';

const NO_LINK = 'none';

export interface StaffWriteLink {
  id: string;
  label: string;
}

export interface StaffWriteTarget {
  kind: StaffKind;
  partyId: string;
  partyName?: string;
  links?: readonly StaffWriteLink[];
  defaultLinkId?: string;
}

export interface ComposeDialogProps {
  target: StaffWriteTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ComposeDialog({ target, open, onOpenChange }: ComposeDialogProps) {
  const copy = staffKindCopy[target.kind];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={target.partyName ? `Écrire à ${target.partyName}` : `Écrire à ${copy.party}`}
        description="Le message est remis dans l’espace de la personne et reste dans l’historique de l’organisation."
        className="max-w-[560px]"
      >
        {open ? <ComposeForm target={target} onClose={() => { onOpenChange(false); }} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ComposeForm({ target, onClose }: { target: StaffWriteTarget; onClose: () => void }) {
  const { routes, navigate } = useStaffConfig();
  const copy = staffKindCopy[target.kind];
  const open = useStaffOpenThread();
  const intent = useSendIntent();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const links = target.links ?? [];
  const required = target.kind === 'tenant';
  const [linkId, setLinkId] = useState(target.defaultLinkId ?? (required && links.length === 1 ? (links[0]?.id ?? '') : NO_LINK));
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const chosen = linkId === NO_LINK ? null : linkId;

  const submit = async () => {
    const parsed = newMessageInputSchema.safeParse({ recipientId: target.partyId, linkId: '', subject, body });
    const missingLink = required && chosen === null;
    if (!parsed.success || missingLink) {
      setErrors({ ...(parsed.success ? {} : fieldErrors(parsed.error)), ...(missingLink ? { linkId: 'Choisissez le bail concerné' } : {}) });
      return;
    }
    setErrors({});
    setFailure(null);
    const clientId = intent.clientIdFor(fingerprintOf([target.kind, target.partyId, chosen ?? '', parsed.data.subject, parsed.data.body], []));
    try {
      const thread = await open.mutateAsync({
        kind: target.kind,
        partyId: target.partyId,
        leaseId: required ? chosen : null,
        mandateId: required ? null : chosen,
        subject: parsed.data.subject,
        body: parsed.data.body,
        files: [],
        clientId,
      });
      intent.settle();
      onClose();
      navigate(routes.thread(thread.id));
    } catch (error) {
      setFailure(staffSendFailureMessage(error));
    }
  };

  const linkOptions = [...(required ? [] : [{ value: NO_LINK, label: 'Sans mandat précis' }]), ...links.map((link) => ({ value: link.id, label: link.label }))];
  const clear = (key: string) => { if (errors[key]) setErrors({ ...errors, [key]: undefined }); };

  return (
    <form
      noValidate
      aria-label="Nouveau message"
      className="flex flex-col gap-3 px-4 pt-3 pb-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void submit();
      }}
    >
      {links.length > 1 || (!required && links.length > 0) ? (
        <Select
          label={required ? 'Bail concerné *' : 'Mandat concerné'}
          placeholder="Choisir"
          options={linkOptions}
          value={linkId}
          onValueChange={(value) => { setLinkId(value); clear('linkId'); }}
          {...(errors.linkId ? { error: errors.linkId } : {})}
        />
      ) : required && links[0] ? (
        <TextField label="Bail concerné" placeholder={links[0].label} value={links[0].label} readOnly />
      ) : null}
      <TextField
        data-autofocus
        label="Objet *"
        placeholder={copy.composeSubject}
        value={subject}
        maxLength={140}
        onChange={(event) => { setSubject(event.target.value); clear('subject'); }}
        {...(errors.subject ? { error: errors.subject } : {})}
      />
      <div className="flex flex-col gap-1.5">
        <Textarea
          ref={bodyRef}
          label="Message *"
          placeholder="Écrivez votre message"
          rows={6}
          value={body}
          onChange={(event) => { setBody(event.target.value); clear('body'); }}
          {...(errors.body ? { error: errors.body } : {})}
        />
        <FormatToolbar fieldRef={bodyRef} value={body} onChange={setBody} disabled={open.isPending} />
      </div>
      <NoticeNotAFormalAct />
      {failure ? <Alert tone="danger" title="Envoi impossible">{failure}</Alert> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Annuler</Button>
        </DialogClose>
        <Button type="submit" loading={open.isPending}>
          <Icon icon={Send} />
          Envoyer
        </Button>
      </div>
    </form>
  );
}
