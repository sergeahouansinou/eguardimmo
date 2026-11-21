'use client';

import { Button, Dialog, DialogClose, DialogContent, TextField, Textarea } from '@eguardimmo/ui';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { formatMoney } from '../../format/money';
import { amountHint } from '../finances/banking/money';
import { FilePicker, useNotify } from '../locataires/kit';
import { formatDateFr } from '../locataires/kit/dates';
import { ActionError } from '../orgapi/ActionError';
import { ConfirmAction } from '../orgapi/ConfirmAction';
import { FormSelect, useOrgForm } from '../orgapi/form';
import { FILE_ACCEPT, attestationFormSchema, attestationToInput, feeFormSchema, feeToInput, prepaymentFormSchema, prepaymentToInput, validateFile } from './forms';
import type { AttestationFormValues, FeeFormValues, PrepaymentFormValues } from './forms';
import { useAddAttestation, useAddFee, useImportSchedule, usePrepayLoan, useVoidLoan } from './hooks';
import { feeLabel, prepaymentLabel } from './labels';
import { FEE_KINDS, PREPAYMENT_OPTIONS } from './model';
import type { Loan, Schedule } from './model';

function FormDialog({ open, title, description, onClose, children }: { open: boolean; title: string; description: string; onClose: () => void; children: ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title={title} description={description} className="max-w-[560px]">
        {open ? children : null}
      </DialogContent>
    </Dialog>
  );
}

function Footer({ submit, loading, failure, failureTitle }: { submit: string; loading: boolean; failure: unknown; failureTitle: string }) {
  return (
    <>
      {failure === null ? null : <ActionError title={failureTitle} error={failure} />}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button type="submit" loading={loading}>{submit}</Button>
      </div>
    </>
  );
}

const formClass = 'flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-4';

export function PrepayDialog({ open, loan, schedule, onClose }: { open: boolean; loan: Loan; schedule: Schedule | undefined; onClose: () => void }) {
  return (
    <FormDialog open={open} title="Remboursement anticipé" description="Le serveur recalcule le tableau à compter de l’échéance choisie. L’ancien tableau reste consultable dans l’historique du prêt." onClose={onClose}>
      <PrepayForm loan={loan} schedule={schedule} onClose={onClose} />
    </FormDialog>
  );
}

function PrepayForm({ loan, schedule, onClose }: { loan: Loan; schedule: Schedule | undefined; onClose: () => void }) {
  const currency = loan.principal.currency;
  const prepay = usePrepayLoan();
  const notify = useNotify();
  const [failure, setFailure] = useState<unknown>(null);
  const schema = useMemo(() => prepaymentFormSchema(currency), [currency]);
  const form = useOrgForm<PrepaymentFormValues, PrepaymentFormValues>(schema, { date: '', amount: '', option: 'reduce_term', penalty: '' });
  const errors = form.formState.errors;
  const upcoming = (schedule?.lines ?? []).filter((line) => line.dueOn > loan.outstanding.asOf);

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      await prepay.mutateAsync({ id: loan.id, input: prepaymentToInput(values, currency, loan.lockVersion) });
      notify({ title: 'Remboursement anticipé enregistré', description: 'Le tableau a été recalculé.' });
      onClose();
    } catch (error) {
      setFailure(error);
    }
  });

  return (
    <form noValidate className={formClass} onSubmit={(event) => { event.stopPropagation(); void submit(event); }}>
      <FormSelect control={form.control} name="date" label="À l’échéance du *" placeholder="Choisissez une échéance" searchable options={upcoming.map((line) => ({ value: line.dueOn, label: formatDateFr(line.dueOn) }))} hint="Un remboursement se fait à une date d’échéance du tableau." />
      <TextField label="Montant remboursé *" inputMode="decimal" placeholder={amountHint(currency)} hint={`Capital restant dû selon l’échéancier : ${formatMoney(loan.outstanding.amount.amount, currency)}`} error={errors.amount?.message} {...form.register('amount')} data-autofocus />
      <FormSelect control={form.control} name="option" label="Effet *" placeholder="Choisissez" options={PREPAYMENT_OPTIONS.map((value) => ({ value, label: prepaymentLabel[value] }))} />
      <TextField label="Indemnité de remboursement anticipé" inputMode="decimal" placeholder={amountHint(currency)} error={errors.penalty?.message} {...form.register('penalty')} />
      <Footer submit="Enregistrer le remboursement" loading={form.formState.isSubmitting} failure={failure} failureTitle="Remboursement non enregistré" />
    </form>
  );
}

export function FeeDialog({ open, loan, onClose }: { open: boolean; loan: Loan; onClose: () => void }) {
  return (
    <FormDialog open={open} title="Ajouter des frais" description="Frais de dossier, de garantie, d’hypothèque ou indemnités : ils entrent dans les frais d’emprunt de l’année de leur paiement." onClose={onClose}>
      <FeeForm loan={loan} onClose={onClose} />
    </FormDialog>
  );
}

function FeeForm({ loan, onClose }: { loan: Loan; onClose: () => void }) {
  const currency = loan.principal.currency;
  const add = useAddFee();
  const notify = useNotify();
  const [failure, setFailure] = useState<unknown>(null);
  const [document, setDocument] = useState<File | null>(null);
  const schema = useMemo(() => feeFormSchema(currency), [currency]);
  const form = useOrgForm<FeeFormValues, FeeFormValues>(schema, { kind: 'dossier', paidOn: '', amount: '' });
  const errors = form.formState.errors;
  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      await add.mutateAsync({ id: loan.id, input: feeToInput(values, currency, document) });
      notify({ title: 'Frais ajoutés' });
      onClose();
    } catch (error) {
      setFailure(error);
    }
  });
  return (
    <form noValidate className={formClass} onSubmit={(event) => { event.stopPropagation(); void submit(event); }}>
      <FormSelect control={form.control} name="kind" label="Nature *" placeholder="Choisissez" options={FEE_KINDS.map((value) => ({ value, label: feeLabel[value] }))} />
      <TextField label="Payé le *" type="date" placeholder="AAAA-MM-JJ" error={errors.paidOn?.message} {...form.register('paidOn')} data-autofocus />
      <TextField label="Montant *" inputMode="decimal" placeholder={amountHint(currency)} error={errors.amount?.message} {...form.register('amount')} />
      <FilePicker label="Justificatif (facultatif)" hint="PDF, JPG ou PNG, 10 Mo au plus" accept={FILE_ACCEPT} validate={validateFile} file={document} onFile={setDocument} />
      <Footer submit="Ajouter les frais" loading={form.formState.isSubmitting} failure={failure} failureTitle="Frais non ajoutés" />
    </form>
  );
}

export function AttestationDialog({ open, loan, onClose }: { open: boolean; loan: Loan; onClose: () => void }) {
  return (
    <FormDialog open={open} title="Attestation de la banque" description="Les intérêts, l’assurance et les frais attestés par la banque priment sur l’échéancier pour la déclaration de l’année. La pièce est obligatoire." onClose={onClose}>
      <AttestationForm loan={loan} onClose={onClose} />
    </FormDialog>
  );
}

function AttestationForm({ loan, onClose }: { loan: Loan; onClose: () => void }) {
  const currency = loan.principal.currency;
  const add = useAddAttestation();
  const notify = useNotify();
  const [failure, setFailure] = useState<unknown>(null);
  const [document, setDocument] = useState<File | null>(null);
  const [missing, setMissing] = useState(false);
  const schema = useMemo(() => attestationFormSchema(currency), [currency]);
  const form = useOrgForm<AttestationFormValues, AttestationFormValues>(schema, { incomeYear: '', interest: '', insurance: '', fees: '' });
  const errors = form.formState.errors;
  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    if (document === null) {
      setMissing(true);
      return;
    }
    try {
      await add.mutateAsync({ id: loan.id, input: attestationToInput(values, currency, document) });
      notify({ title: 'Attestation enregistrée' });
      onClose();
    } catch (error) {
      setFailure(error);
    }
  });
  return (
    <form noValidate className={formClass} onSubmit={(event) => { event.stopPropagation(); void submit(event); }}>
      <TextField label="Année de revenus *" inputMode="numeric" placeholder="ex. 2025" error={errors.incomeYear?.message} {...form.register('incomeYear')} data-autofocus />
      <TextField label="Intérêts payés *" inputMode="decimal" placeholder={amountHint(currency)} error={errors.interest?.message} {...form.register('interest')} />
      <TextField label="Assurance emprunteur" inputMode="decimal" placeholder={amountHint(currency)} error={errors.insurance?.message} {...form.register('insurance')} />
      <TextField label="Frais d’emprunt" inputMode="decimal" placeholder={amountHint(currency)} error={errors.fees?.message} {...form.register('fees')} />
      <FilePicker label="Attestation de la banque *" hint="PDF, JPG ou PNG, 10 Mo au plus" accept={FILE_ACCEPT} validate={validateFile} file={document} onFile={(file) => { setDocument(file); setMissing(false); }} {...(missing ? { error: 'Joignez l’attestation de la banque.' } : {})} />
      <Footer submit="Enregistrer l’attestation" loading={form.formState.isSubmitting} failure={failure} failureTitle="Attestation non enregistrée" />
    </form>
  );
}

const CSV_MAX_BYTES = 256 * 1024;

function validateCsv(file: File): string | null {
  if (!/\.(csv|txt)$/i.test(file.name)) return 'Choisissez un fichier CSV.';
  if (file.size > CSV_MAX_BYTES) return 'Le fichier ne peut pas dépasser 256 Ko.';
  return null;
}

export function ImportScheduleDialog({ open, loan, onClose }: { open: boolean; loan: Loan; onClose: () => void }) {
  return (
    <FormDialog open={open} title="Importer le tableau de la banque" description="Colonnes : date ; mensualité ; intérêts ; capital ; assurance ; restant dû (600 lignes au plus). Le serveur revérifie le tableau, qui remplace alors le calcul." onClose={onClose}>
      <ImportForm loan={loan} onClose={onClose} />
    </FormDialog>
  );
}

function ImportForm({ loan, onClose }: { loan: Loan; onClose: () => void }) {
  const run = useImportSchedule();
  const notify = useNotify();
  const [file, setFile] = useState<File | null>(null);
  const [missing, setMissing] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setFailure(null);
    if (file === null) {
      setMissing(true);
      return;
    }
    setLoading(true);
    try {
      await run.mutateAsync({ id: loan.id, file, lockVersion: loan.lockVersion });
      notify({ title: 'Tableau importé', description: 'Il remplace désormais le calcul du serveur.' });
      onClose();
    } catch (error) {
      setFailure(error);
    } finally {
      setLoading(false);
    }
  };
  return (
    <form noValidate className={formClass} onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); void submit(); }}>
      <FilePicker label="Tableau d’amortissement (CSV) *" hint="CSV UTF-8, 256 Ko au plus" accept=".csv,.txt,text/csv,text/plain" validate={validateCsv} file={file} onFile={(next) => { setFile(next); setMissing(false); }} {...(missing ? { error: 'Choisissez le fichier du tableau.' } : {})} />
      <Footer submit="Importer le tableau" loading={loading} failure={failure} failureTitle="Tableau non importé" />
    </form>
  );
}

export function VoidLoanDialog({ open, loan, onClose }: { open: boolean; loan: Loan; onClose: () => void }) {
  const run = useVoidLoan();
  const notify = useNotify();
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <ConfirmAction
      open={open}
      title="Annuler la saisie de ce prêt"
      description="Le prêt reste consultable avec son motif d’annulation mais n’entre plus dans vos chiffres. Il est refusé si une synthèse fiscale figée l’utilise."
      confirmLabel="Annuler la saisie"
      failureTitle="Saisie non annulée"
      tone="danger"
      extra={
        <Textarea label="Motif de l’annulation *" placeholder="Ex. saisie en double" value={reason} error={problem ?? undefined} onChange={(event) => { setReason(event.target.value); setProblem(null); }} />
      }
      run={async () => {
        const trimmed = reason.trim();
        if (trimmed.length < 3 || trimmed.length > 255) {
          const message = 'Le motif doit contenir de 3 à 255 caractères.';
          setProblem(message);
          throw new Error(message);
        }
        await run.mutateAsync({ id: loan.id, reason: trimmed, lockVersion: loan.lockVersion });
        notify({ title: 'Saisie annulée' });
        setReason('');
      }}
      onClose={() => { setReason(''); setProblem(null); onClose(); }}
    />
  );
}
