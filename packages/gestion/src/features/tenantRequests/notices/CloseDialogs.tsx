'use client';

import { Alert, Button, Checkbox, Dialog, DialogClose, DialogContent, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNotify } from '../../locataires/kit';
import { todayIso } from '../../locataires/kit/dates';
import { useTenantRequestsForm } from '../shared/form';
import { useLeaseDetail } from '../shared/hooks';
import type { LeaseDetailView } from '../shared/leaseLookup';
import { ActionError } from '../shared/parts/ActionError';
import { QueryState } from '../shared/parts/QueryState';
import { useEndParticipant, useRecordLeaseNotice } from './hooks';
import type { NoticeRequest } from './model';
import { reasonLabel } from './model';
import { endParticipantSchema, leaseNoticeSchema } from './schemas';
import type { EndParticipantValues, LeaseNoticeValues } from './schemas';

function DialogShell({ open, title, description, leaseId, onClose, children }: {
  open: boolean;
  title: string;
  description: string;
  leaseId: string;
  onClose: () => void;
  children: (lease: LeaseDetailView) => ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title={title} description={description} className="max-w-[520px]">
        {open ? <LeaseGate leaseId={leaseId}>{children}</LeaseGate> : null}
      </DialogContent>
    </Dialog>
  );
}

function LeaseGate({ leaseId, children }: { leaseId: string; children: (lease: LeaseDetailView) => ReactNode }) {
  const lease = useLeaseDetail(leaseId);
  if (lease.data) return <>{children(lease.data)}</>;
  return <div className="p-4"><QueryState query={lease} label="Chargement du bail" title="Impossible de charger le bail" /></div>;
}

function Footer({ loading, label }: { loading: boolean; label: string }) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <DialogClose asChild>
        <Button variant="ghost">Retour</Button>
      </DialogClose>
      <Button type="submit" loading={loading}>{label}</Button>
    </div>
  );
}

export function RecordLeaseNoticeDialog({ notice, open, onClose }: { notice: NoticeRequest; open: boolean; onClose: () => void }) {
  return (
    <DialogShell
      open={open}
      leaseId={notice.leaseId}
      title="Enregistrer le congé sur le bail"
      description="Le congé est acté sur le bail entier, comme donné par le locataire. Les autres demandes en cours de ce bail deviennent sans objet."
      onClose={onClose}
    >
      {(lease) => <LeaseNoticeForm notice={notice} lease={lease} onDone={onClose} />}
    </DialogShell>
  );
}

function LeaseNoticeForm({ notice, lease, onDone }: { notice: NoticeRequest; lease: LeaseDetailView; onDone: () => void }) {
  const record = useRecordLeaseNotice();
  const notify = useNotify();
  const [failure, setFailure] = useState<unknown>(null);
  const today = todayIso();
  const form = useTenantRequestsForm<LeaseNoticeValues, LeaseNoticeValues>(leaseNoticeSchema, {
    receivedOn: notice.receivedOn ?? today,
    departureOn: notice.requestedDepartureOn,
    reason: reasonLabel(notice.reasonKey),
    replace: false,
  });

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    if (values.receivedOn > today) {
      form.setError('receivedOn', { message: 'La date de réception ne peut pas être dans le futur.' });
      return;
    }
    try {
      await record.mutateAsync({
        leaseId: lease.id,
        lockVersion: lease.lockVersion,
        requestId: notice.id,
        input: { receivedOn: values.receivedOn, departureOn: values.departureOn === '' ? null : values.departureOn, reason: values.reason, replace: values.replace },
      });
      notify({ title: 'Congé enregistré', description: 'Le préavis est inscrit sur le bail et la demande est clôturée.' });
      onDone();
    } catch (error) {
      setFailure(error);
    }
  });

  return (
    <form noValidate className="flex flex-col gap-3 p-4" onSubmit={(event) => { event.stopPropagation(); void submit(event); }}>
      {notice.status === 'submitted' ? <Alert tone="warning" title="Accusé de réception non posé">Posez d’abord l’accusé de réception pour fixer la date qui fait courir le préavis.</Alert> : null}
      <TextField label="Date de réception *" type="date" placeholder="AAAA-MM-JJ" max={today} error={form.formState.errors.receivedOn?.message} {...form.register('receivedOn')} data-autofocus />
      <TextField label="Date de départ" type="date" placeholder="AAAA-MM-JJ" hint={`Laissez vide pour retenir le premier jour possible. Souhait du locataire : ${notice.requestedDepartureOn.split('-').reverse().join('/')}.`} error={form.formState.errors.departureOn?.message} {...form.register('departureOn')} />
      <TextField label="Motif du congé *" placeholder="Ex. : Mutation professionnelle" error={form.formState.errors.reason?.message} {...form.register('reason')} />
      {lease.noticeReceivedOn === null ? null : <Checkbox label="Remplacer le préavis déjà enregistré sur ce bail" {...form.register('replace')} />}
      {failure === null ? null : <ActionError title="Congé non enregistré" error={failure} />}
      <Footer loading={form.formState.isSubmitting} label="Enregistrer le congé" />
    </form>
  );
}

export function EndParticipantDialog({ notice, open, onClose }: { notice: NoticeRequest; open: boolean; onClose: () => void }) {
  return (
    <DialogShell
      open={open}
      leaseId={notice.leaseId}
      title="Enregistrer le départ de ce locataire seul"
      description="Seule la participation de ce locataire prend fin ; le bail continue pour les autres. Ses autres demandes en cours deviennent sans objet."
      onClose={onClose}
    >
      {(lease) => <EndParticipantForm notice={notice} lease={lease} onDone={onClose} />}
    </DialogShell>
  );
}

function EndParticipantForm({ notice, lease, onDone }: { notice: NoticeRequest; lease: LeaseDetailView; onDone: () => void }) {
  const end = useEndParticipant();
  const notify = useNotify();
  const [failure, setFailure] = useState<unknown>(null);
  const link = lease.participants.find((participant) => participant.partyId === notice.partyId && participant.role === 'tenant' && participant.endDate === null);
  const form = useTenantRequestsForm<EndParticipantValues, EndParticipantValues>(endParticipantSchema, { validTo: notice.requestedDepartureOn });

  const submit = form.handleSubmit(async ({ validTo }) => {
    setFailure(null);
    if (link === undefined) return;
    try {
      await end.mutateAsync({ leaseId: lease.id, linkId: link.linkId, lockVersion: lease.lockVersion, requestId: notice.id, validTo });
      notify({ title: 'Départ enregistré', description: 'La participation du locataire est terminée et la demande est clôturée.' });
      onDone();
    } catch (error) {
      setFailure(error);
    }
  });

  if (link === undefined) {
    return <div className="p-4"><Alert tone="info" title="Aucune participation en cours">Ce locataire n’a plus de participation active sur ce bail.</Alert></div>;
  }

  return (
    <form noValidate className="flex flex-col gap-3 p-4" onSubmit={(event) => { event.stopPropagation(); void submit(event); }}>
      <TextField label="Dernier jour de présence *" type="date" placeholder="AAAA-MM-JJ" hint="Le dernier jour inclus, ex. 2027-02-28." error={form.formState.errors.validTo?.message} {...form.register('validTo')} data-autofocus />
      {failure === null ? null : <ActionError title="Départ non enregistré" error={failure} />}
      <Footer loading={form.formState.isSubmitting} label="Enregistrer le départ" />
    </form>
  );
}
