'use client';

import { Alert, Button, Dialog, DialogClose, DialogContent, Select } from '@eguardimmo/ui';
import { useBailiffs, useTransmit } from './hooks';
import { DEFAULT_VALID_DAYS, ValiditySelect } from './ValiditySelect';
import type { Bundle } from './model';
import { transmitFormSchema } from './schemas';
import { ListLoading, errorMessage, useNotify } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { useZodForm } from '../../locataires/kit/useZodForm';

export function TransmitDialog({ bundle, open, onClose }: { bundle: Bundle; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title="Transmettre au commissaire de justice" description="Le commissaire reçoit par e-mail un lien sécurisé de téléchargement, jamais les pièces elles-mêmes." className="max-w-[520px]">
        {open ? <TransmitForm bundle={bundle} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function TransmitForm({ bundle, onClose }: { bundle: Bundle; onClose: () => void }) {
  const notify = useNotify();
  const transmit = useTransmit();
  const bailiffs = useBailiffs(true);
  const form = useZodForm(transmitFormSchema, { recipientPartyId: '', validDays: String(DEFAULT_VALID_DAYS) });
  const reachable = (bailiffs.data ?? []).filter((bailiff) => bailiff.email !== null && bailiff.email !== '');
  const withoutEmail = (bailiffs.data ?? []).length - reachable.length;
  const failure = transmit.error ? errorMessage(transmit.error) : null;

  const submit = () => {
    const values = form.submit();
    if (values === null) return;
    transmit.mutate(
      { bundleId: bundle.id, input: { recipientPartyId: values.recipientPartyId, validDays: Number(values.validDays) } },
      {
        onSuccess: (transmission) => {
          notify({ title: 'Lien envoyé', description: `Lien envoyé à ${transmission.recipientEmail}, valable jusqu’au ${formatDateFr(transmission.expiresAt.slice(0, 10))}.` });
          onClose();
        },
      },
    );
  };

  return (
    <form noValidate className="flex max-h-[75vh] flex-col gap-3 overflow-y-auto p-4" onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); submit(); }}>
      {failure ? <Alert tone="danger" title="Transmission impossible">{failure}</Alert> : null}
      {bailiffs.isError ? <Alert tone="danger" title="Les commissaires de justice n’ont pas pu être chargés">{bailiffs.error?.message}</Alert> : null}
      {bailiffs.isPending && !bailiffs.isError ? <ListLoading label="Chargement des commissaires de justice" /> : null}
      {bailiffs.data && reachable.length === 0 ? (
        <Alert tone="warning" title="Aucun commissaire de justice joignable">
          {withoutEmail > 0 ? 'Les commissaires de justice de vos contacts n’ont pas d’adresse e-mail. ' : ''}
          Ajoutez un contact de catégorie « Commissaire de justice » avec une adresse e-mail pour pouvoir lui envoyer le lien.
        </Alert>
      ) : null}
      {reachable.length > 0 ? (
        <Select
          label="Commissaire de justice"
          placeholder="Choisir un commissaire de justice"
          options={reachable.map((bailiff) => ({ value: bailiff.id, label: bailiff.name, description: bailiff.email ?? undefined }))}
          value={form.values.recipientPartyId}
          error={form.error('recipientPartyId')}
          onValueChange={(value) => { form.setValue('recipientPartyId', value); }}
        />
      ) : null}
      <ValiditySelect value={form.values.validDays} error={form.error('validDays')} onChange={(value) => { form.setValue('validDays', value); }} />
      <p className="text-caption text-fg-subtle">{`Envoi ${bundle.number} : ${String(bundle.pieces.length)} pièces. L’envoi et son lien sont inscrits au carnet des diligences.`}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Annuler</Button>
        </DialogClose>
        <Button type="submit" loading={transmit.isPending} disabled={reachable.length === 0}>Envoyer le lien</Button>
      </div>
    </form>
  );
}
