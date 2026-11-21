'use client';

import { Button, Dialog, DialogClose, DialogContent, IconButton, TextField } from '@eguardimmo/ui';
import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray } from 'react-hook-form';
import type { Currency } from '../../../format/money';
import { useSettleLine } from './hooks';
import { moneyText } from './labels';
import type { BankLine } from './model';
import { minorToInput, parseMinor } from './money';
import { ActionError } from './parts/ActionError';
import { FormSelect, useBankingForm } from './parts/form';
import { settleFormSchema, settleFormToInput } from './schemas';
import type { SettleValues } from './schemas';
import { useInvoices } from '../invoicing/hooks';
import { useLeaseChoices } from '../rent/useLeaseChoices';
import { useNotify } from '../../locataires/kit';
import { useAttemptKey } from '../ownerfunds/attemptKey';

type AllocationKey = 'leaseId' | 'amount';
const allocationPath = (index: number, key: AllocationKey): `allocations.${number}.${AllocationKey}` => `allocations.${String(index)}.${key}` as `allocations.${number}.${AllocationKey}`;

export function SettleDialog({ line, onClose }: { line: BankLine | null; onClose: () => void }) {
  return (
    <Dialog open={line !== null} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title="Créer depuis la ligne" description="Enregistrez directement l’encaissement d’un loyer, le règlement d’une facture ou les frais bancaires, puis pointez la ligne." className="max-w-[640px]">
        {line ? <SettleForm line={line} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function SettleForm({ line, onClose }: { line: BankLine; onClose: () => void }) {
  const settle = useSettleLine();
  const notify = useNotify();
  const attemptKey = useAttemptKey();
  const [failure, setFailure] = useState<unknown>(null);
  const currency = line.amount.currency;
  const credit = line.direction === 'credit';
  const form = useBankingForm<SettleValues, SettleValues>(settleFormSchema(line.amount.amount, currency), {
    mode: credit ? 'settle_lease' : 'bank_charges',
    allocations: [{ leaseId: '', amount: minorToInput(line.amount.amount, currency) }],
    invoiceId: '',
    invoiceAmount: '',
  });
  const mode = form.watch('mode');
  const modes = credit
    ? [{ value: 'settle_lease', label: 'Encaisser un loyer' }, { value: 'settle_invoice', label: 'Régler une facture' }]
    : [{ value: 'bank_charges', label: 'Frais bancaires' }];

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    const input = settleFormToInput(values, currency);
    try {
      await settle.mutateAsync({ lineId: line.id, input, lockVersion: line.lockVersion, key: attemptKey(JSON.stringify([line.id, input, line.lockVersion])) });
      notify({ title: 'Ligne pointée', description: 'L’écriture a été créée depuis la ligne du relevé.' });
      onClose();
    } catch (error) {
      setFailure(error);
    }
  });

  return (
    <form noValidate className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-4" onSubmit={(event) => { event.stopPropagation(); void submit(event); }}>
      <p className="text-body text-fg-muted">{`${moneyText(line.signedAmount, { signed: true })} · ${line.label}`}</p>
      <FormSelect control={form.control} name="mode" label="Action *" placeholder="Choisissez l’action" options={modes} disabled={modes.length === 1} />
      {mode === 'settle_lease' ? <LeaseFields form={form} lineMinor={line.amount.amount} currency={currency} /> : null}
      {mode === 'settle_invoice' ? <InvoiceFields form={form} currency={currency} /> : null}
      {mode === 'bank_charges' ? <p className="text-body text-fg-muted">Une écriture de frais bancaires du montant de la ligne sera créée et pointée.</p> : null}
      {failure === null ? null : <ActionError title="Écriture non créée" error={failure} />}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button type="submit" loading={form.formState.isSubmitting}>Créer et pointer</Button>
      </div>
    </form>
  );
}

interface FieldsForm {
  control: Control<SettleValues, undefined, SettleValues>;
  register: UseFormRegister<SettleValues>;
  watch: (name: 'allocations') => SettleValues['allocations'];
  formState: { errors: FieldErrors<SettleValues> };
}

function LeaseFields({ form, lineMinor, currency }: { form: FieldsForm; lineMinor: number; currency: Currency }) {
  const leases = useLeaseChoices();
  const allocations = useFieldArray({ control: form.control, name: 'allocations' });
  const errors = form.formState.errors;
  const total = form.watch('allocations').reduce((sum, row) => sum + (parseMinor(row.amount, currency) ?? 0), 0);
  const remaining = lineMinor - total;
  const rootError = errors.allocations?.root?.message ?? errors.allocations?.message;
  return (
    <fieldset className="flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-1 p-0 text-caption text-fg-muted">Répartition entre les échéances *</legend>
      {allocations.fields.map((field, index) => (
        <div key={field.id} className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[1fr_160px_auto]">
          <FormSelect control={form.control} name={allocationPath(index, 'leaseId')} label={`Bail ${String(index + 1)}`} placeholder="Choisissez le bail" options={leases.options} searchable />
          <TextField label="Montant" placeholder={currency === 'XOF' ? 'ex. 450000' : 'ex. 850,50'} inputMode="text" error={errors.allocations?.[index]?.amount?.message} {...form.register(allocationPath(index, 'amount'))} />
          {allocations.fields.length > 1 ? <IconButton label={`Retirer la ligne ${String(index + 1)}`} icon={Trash2} variant="danger" onClick={() => { allocations.remove(index); }} /> : <span />}
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => { allocations.append({ leaseId: '', amount: remaining > 0 ? minorToInput(remaining, currency) : '' }); }}>
          <Plus className="size-4" aria-hidden="true" />
          Ajouter un bail
        </Button>
        <span className="text-caption text-fg-subtle" aria-live="polite">{remaining === 0 ? 'Répartition complète.' : `Reste à répartir : ${moneyText({ amount: remaining, currency }, { signed: true })}`}</span>
      </div>
      {rootError === undefined ? null : <span role="alert" className="text-caption text-fg-danger">{rootError}</span>}
    </fieldset>
  );
}

function InvoiceFields({ form, currency }: { form: FieldsForm; currency: Currency }) {
  const issued = useInvoices({ kind: 'invoice', status: 'issued', perPage: 100 });
  const partial = useInvoices({ kind: 'invoice', status: 'partially_paid', perPage: 100 });
  const options = [...(issued.data?.items ?? []), ...(partial.data?.items ?? [])].map((invoice) => ({
    value: invoice.id,
    label: `${invoice.number ?? 'Facture'} · reste ${moneyText(invoice.outstanding ?? invoice.totalGross)}`,
  }));
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <FormSelect control={form.control} name="invoiceId" label="Facture *" placeholder="Choisissez la facture" options={options} searchable emptyLabel="Aucune facture à régler" />
      <TextField label="Montant affecté" placeholder={currency === 'XOF' ? 'ex. 450000' : 'ex. 850,50'} hint="Laissez vide pour affecter toute la ligne." error={form.formState.errors.invoiceAmount?.message} {...form.register('invoiceAmount')} />
    </div>
  );
}
