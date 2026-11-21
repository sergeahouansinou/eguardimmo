'use client';

import { Button, Dialog, DialogClose, DialogContent, TextField } from '@eguardimmo/ui';
import { useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';
import type { Currency } from '../../format/money';
import { amountHint } from '../finances/banking/money';
import { useAttemptKey } from '../finances/ownerfunds/attemptKey';
import { FilePicker, useNotify } from '../locataires/kit';
import { ActionError } from '../orgapi/ActionError';
import { FormSelect, useOrgForm } from '../orgapi/form';
import { useOrgPropertyChoices, useOrgUnitChoices } from '../orgapi/hooks';
import { FILE_ACCEPT, loanFormSchema, loanFormToInput, validateFile } from './forms';
import type { LoanFormValues } from './forms';
import { useCreateLoan } from './hooks';
import { deferralLabel, insuranceLabel, purposeLabel } from './labels';
import { DEFERRAL_KINDS, INSURANCE_MODES, LOAN_PURPOSES } from './model';
import type { Loan } from './model';

const EMPTY: LoanFormValues = {
  propertyId: '',
  unitId: '',
  lenderLabel: '',
  contractReference: '',
  purpose: 'acquisition',
  principal: '',
  nominalRate: '',
  firstDueOn: '',
  termMonths: '',
  deferralKind: 'none',
  deferralMonths: '',
  insuranceMode: 'none',
  insuranceRate: '',
  insuranceAmount: '',
  replacesLoanId: '',
};

export function LoanFormDialog({ open, currency, replaceable, onClose }: { open: boolean; currency: Currency | null; replaceable: readonly Loan[]; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title="Nouveau prêt" description="Saisissez les conditions du contrat : le serveur calcule la mensualité, les intérêts et le capital restant dû. Rien n’est écrit au grand livre." className="max-w-[640px]">
        {currency === null ? (
          <p className="p-4 text-body text-fg-muted">La devise de votre organisation n’est pas prise en charge par ce formulaire.</p>
        ) : (
          <LoanForm currency={currency} replaceable={replaceable} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function LoanForm({ currency, replaceable, onClose }: { currency: Currency; replaceable: readonly Loan[]; onClose: () => void }) {
  const create = useCreateLoan();
  const notify = useNotify();
  const keyFor = useAttemptKey();
  const properties = useOrgPropertyChoices();
  const schema = useMemo(() => loanFormSchema(currency), [currency]);
  const form = useOrgForm<LoanFormValues, LoanFormValues>(schema, EMPTY);
  const [document, setDocument] = useState<File | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [propertyId, deferralKind, insuranceMode] = useWatch({ control: form.control, name: ['propertyId', 'deferralKind', 'insuranceMode'] });
  const units = useOrgUnitChoices(propertyId === '' ? null : propertyId);
  const errors = form.formState.errors;

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    const input = loanFormToInput(values, currency, document);
    try {
      await create.mutateAsync({ input, key: keyFor(JSON.stringify([values, document?.name ?? null, document?.size ?? null])) });
      notify({ title: 'Prêt enregistré', description: 'Le tableau d’amortissement a été calculé par le serveur.' });
      onClose();
    } catch (error) {
      setFailure(error);
    }
  });

  return (
    <form noValidate className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-4" onSubmit={(event) => { event.stopPropagation(); void submit(event); }}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <FormSelect control={form.control} name="propertyId" label="Bien financé *" placeholder="Choisissez un bien" searchable options={(properties.data ?? []).map((property) => ({ value: property.id, label: property.name }))} />
        <FormSelect control={form.control} name="unitId" label="Lot financé" placeholder="Bien entier" disabled={propertyId === ''} options={[{ value: '', label: 'Bien entier' }, ...(units.data ?? []).map((unit) => ({ value: unit.id, label: unit.reference }))]} />
        <TextField label="Prêteur *" placeholder="ex. Banque Populaire" error={errors.lenderLabel?.message} {...form.register('lenderLabel')} data-autofocus />
        <TextField label="Référence du contrat" placeholder="ex. PRET-2026-001" error={errors.contractReference?.message} {...form.register('contractReference')} />
        <FormSelect control={form.control} name="purpose" label="Objet du prêt *" placeholder="Choisissez" options={LOAN_PURPOSES.map((value) => ({ value, label: purposeLabel[value] }))} />
        <TextField label="Capital emprunté *" inputMode="decimal" placeholder={amountHint(currency)} error={errors.principal?.message} {...form.register('principal')} />
        <TextField label="Taux nominal annuel (%) *" inputMode="decimal" placeholder="ex. 3,45" error={errors.nominalRate?.message} {...form.register('nominalRate')} />
        <TextField label="Première échéance *" type="date" placeholder="AAAA-MM-JJ" error={errors.firstDueOn?.message} {...form.register('firstDueOn')} />
        <TextField label="Durée (mois) *" inputMode="numeric" placeholder="ex. 240" error={errors.termMonths?.message} {...form.register('termMonths')} />
        <FormSelect control={form.control} name="deferralKind" label="Différé" placeholder="Choisissez" options={DEFERRAL_KINDS.map((value) => ({ value, label: deferralLabel[value] }))} />
        {deferralKind === 'none' ? null : <TextField label="Durée du différé (mois) *" inputMode="numeric" placeholder="ex. 12" error={errors.deferralMonths?.message} {...form.register('deferralMonths')} />}
        <FormSelect control={form.control} name="insuranceMode" label="Assurance emprunteur" placeholder="Choisissez" options={INSURANCE_MODES.map((value) => ({ value, label: insuranceLabel[value] }))} />
        {insuranceMode === 'initial_capital' || insuranceMode === 'outstanding_capital' ? <TextField label="Taux d’assurance annuel (%) *" inputMode="decimal" placeholder="ex. 0,36" error={errors.insuranceRate?.message} {...form.register('insuranceRate')} /> : null}
        {insuranceMode === 'fixed' ? <TextField label="Assurance par échéance *" inputMode="decimal" placeholder={amountHint(currency)} error={errors.insuranceAmount?.message} {...form.register('insuranceAmount')} /> : null}
        {replaceable.length === 0 ? null : (
          <FormSelect control={form.control} name="replacesLoanId" label="Rachat d’un prêt" placeholder="Aucun" options={[{ value: '', label: 'Aucun' }, ...replaceable.map((loan) => ({ value: loan.id, label: loan.lenderLabel }))]} />
        )}
      </div>
      <FilePicker label="Offre de prêt ou tableau (facultatif)" hint="PDF, JPG ou PNG, 10 Mo au plus" accept={FILE_ACCEPT} validate={validateFile} file={document} onFile={setDocument} />
      {failure === null ? null : <ActionError title="Prêt non enregistré" error={failure} />}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button type="submit" loading={form.formState.isSubmitting}>Enregistrer le prêt</Button>
      </div>
    </form>
  );
}
