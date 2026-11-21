'use client';

import { Alert, Button, Checkbox, Dialog, DialogClose, DialogContent, Textarea, TextField } from '@eguardimmo/ui';
import { useRef, useState } from 'react';
import { formatQuantity } from './amounts';
import { useCreateCreditNote, useInvoice } from './hooks';
import { documentName, moneyText } from './labels';
import type { CreditLineInput, Invoice } from './model';
import { ListLoading, errorMessage, useNotify } from '../../locataires/kit';

export function CreditNoteDialog({ invoiceId, onClose }: { invoiceId: string | null; onClose: () => void }) {
  return (
    <Dialog open={invoiceId !== null} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title="Émettre un avoir" description="L’avoir est numéroté, rattaché à la facture d’origine et inscrit au grand livre. Il ne peut pas dépasser le reste dû." className="max-h-[90vh] w-[min(720px,calc(100vw-32px))] overflow-y-auto">
        {invoiceId ? <CreditLoader key={invoiceId} invoiceId={invoiceId} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function CreditLoader({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) {
  const invoice = useInvoice(invoiceId);
  if (invoice.isError) return <div className="p-4"><Alert tone="danger" title="La facture n’a pas pu être chargée">{invoice.error?.message}</Alert></div>;
  if (!invoice.data?.lines) return <div className="p-4"><ListLoading label="Chargement de la facture" /></div>;
  return <CreditForm invoice={invoice.data} lines={invoice.data.lines} onClose={onClose} />;
}

function CreditForm({ invoice, lines, onClose }: { invoice: Invoice; lines: NonNullable<Invoice['lines']>; onClose: () => void }) {
  const create = useCreateCreditNote();
  const notify = useNotify();
  const [reason, setReason] = useState('');
  const [full, setFull] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const trimmed = reason.trim();
  const reasonError = touched && (trimmed.length < 2 || trimmed.length > 255) ? 'Indiquez un motif de 2 à 255 caractères.' : undefined;

  const keyFor = (signature: string): string => {
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: globalThis.crypto.randomUUID() };
    return attempt.current.key;
  };

  const submit = async () => {
    setTouched(true);
    setFailure(null);
    if (trimmed.length < 2 || trimmed.length > 255) return;
    const credited: CreditLineInput[] = lines.map((line) => ({ lineId: line.id, quantity: quantities[line.id] ?? '' }));
    try {
      const note = await create.mutateAsync({ invoiceId: invoice.id, input: { reason: trimmed, full, lines: credited, idempotencyKey: keyFor(JSON.stringify([trimmed, full, credited])) } });
      notify({ title: note.replayed === true ? 'Avoir déjà émis' : 'Avoir émis', description: `${documentName(note)} de ${moneyText(note.totalGross)} sur ${documentName(invoice)}.` });
      onClose();
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-3 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void submit();
      }}
    >
      <Textarea label="Motif *" placeholder="Ex. Remise commerciale accordée au mandant" rows={2} value={reason} error={reasonError} onChange={(event) => { setReason(event.target.value); }} onBlur={() => { setTouched(true); }} data-autofocus />
      <Checkbox label="Avoir total : toutes les lignes, dans la limite du reste dû" checked={full} onChange={(event) => { setFull(event.target.checked); }} />
      {full ? null : (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-caption text-fg-muted">Quantités à créditer (laissez vide pour ne pas créditer la ligne)</legend>
          {lines.map((line, index) => (
            <div key={line.id} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_160px]">
              <p className="min-w-0 text-body break-words">
                <span className="font-semibold">{line.description}</span>
                <span className="block text-caption text-fg-subtle">{`${formatQuantity(line.quantityMilli)} × ${moneyText(line.unitPrice)}`}</span>
              </p>
              <TextField
                label={`Quantité à créditer, ligne ${String(index + 1)}`}
                hideLabel
                placeholder={`Sur ${formatQuantity(line.quantityMilli)}`}
                inputMode="decimal"
                value={quantities[line.id] ?? ''}
                onChange={(event) => { setQuantities((current) => ({ ...current, [line.id]: event.target.value })); }}
              />
            </div>
          ))}
        </fieldset>
      )}
      {failure ? <Alert tone="danger" title="Avoir non émis">{failure}</Alert> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button type="submit" variant="danger" loading={create.isPending}>Émettre l’avoir</Button>
      </div>
    </form>
  );
}
