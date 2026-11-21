'use client';

import { Button, Dialog, DialogClose, DialogContent, TextField } from '@eguardimmo/ui';
import { useMemo, useState } from 'react';
import { Controller } from 'react-hook-form';
import { CsvProfileEditor, csvErrorsOf } from './CsvProfileEditor';
import { useBankingCurrency, useCreateAccount, useReplaceAccount, useUpdateAccount } from './hooks';
import { ledgerRoleLabel } from './labels';
import { IDENTIFIER_KINDS, LEDGER_ROLES } from './model';
import type { BankAccount } from './model';
import type { Currency } from '../../../format/money';
import { minorToInput } from './money';
import { ActionError } from './parts/ActionError';
import { FormSelect, useBankingForm } from './parts/form';
import { runWithProof } from './parts/proof';
import { accountFormSchema, accountFormToInput, defaultCsvDraft, draftToProfile, editAccountSchema, profileToDraft } from './schemas';
import type { AccountFormValues, EditAccountValues } from './schemas';
import { ListLoading, LoadError, useNotify } from '../../locataires/kit';
import { todayIso } from '../../locataires/kit/dates';
import { useAttemptKey } from '../ownerfunds/attemptKey';
import { useTwoFactorProof } from '../../reauth';
import type { TwoFactorProof } from '../../reauth';
import { useBankingSource } from './source';

export type AccountDialogTarget = { mode: 'create' } | { mode: 'replace'; account: BankAccount } | { mode: 'edit'; account: BankAccount };

const TITLES = { create: 'Nouveau compte bancaire', replace: 'Remplacer le compte', edit: 'Modifier le compte' } as const;
const DESCRIPTIONS = {
  create: 'L’IBAN est chiffré dès l’enregistrement : seuls ses quatre derniers caractères resteront affichés.',
  replace: 'Le compte actuel est fermé, son historique reste consultable. Saisissez le nouveau compte et son solde d’ouverture.',
  edit: 'Modifiez le nom du compte et son profil d’import CSV. L’IBAN ne se modifie pas : remplacez le compte si la banque l’a changé.',
} as const;

export function AccountFormDialog({ target, onClose }: { target: AccountDialogTarget | null; onClose: () => void }) {
  const source = useBankingSource();
  const proof = useTwoFactorProof(source.confirmTwoFactor);
  return (
    <>
      <Dialog open={target !== null} onOpenChange={(next) => { if (!next) onClose(); }}>
        <DialogContent title={target ? TITLES[target.mode] : TITLES.create} description={target ? DESCRIPTIONS[target.mode] : DESCRIPTIONS.create} className="max-w-[640px]">
          {target?.mode === 'edit' ? <EditForm account={target.account} proof={proof} onClose={onClose} /> : null}
          {target && target.mode !== 'edit' ? <AccountForm target={target} proof={proof} onClose={onClose} /> : null}
        </DialogContent>
      </Dialog>
      {proof.dialog}
    </>
  );
}

function AccountForm({ target, proof, onClose }: { target: Exclude<AccountDialogTarget, { mode: 'edit' }>; proof: TwoFactorProof; onClose: () => void }) {
  const currency = useBankingCurrency();
  if (currency.isPending) return <ListLoading label="Chargement de la devise" />;
  if (currency.isError) return <LoadError title="Impossible de déterminer la devise de l’organisation" />;
  return <AccountFormBody target={target} proof={proof} currency={currency.data ?? null} onClose={onClose} />;
}

function AccountFormBody({ target, proof, currency, onClose }: { target: Exclude<AccountDialogTarget, { mode: 'edit' }>; proof: TwoFactorProof; currency: Currency | null; onClose: () => void }) {
  const create = useCreateAccount();
  const replace = useReplaceAccount();
  const notify = useNotify();
  const attemptKey = useAttemptKey();
  const [failure, setFailure] = useState<unknown>(null);
  const schema = useMemo(() => accountFormSchema(currency), [currency]);
  const previous = target.mode === 'replace' ? target.account : null;
  const form = useBankingForm<AccountFormValues, ReturnType<typeof schema.parse>>(schema, {
    ledgerRole: previous?.ledgerRole ?? 'bank',
    label: previous?.label ?? '',
    bankName: previous?.bankName ?? '',
    holderName: previous?.holderName ?? '',
    identifierKind: 'iban',
    identifier: '',
    country: previous?.country ?? '',
    reconciliationFrom: todayIso(),
    openingBalance: '',
    currency: '',
    csv: previous ? profileToDraft(previous.csvProfile) : defaultCsvDraft(),
  });
  const effectiveCurrency = currency ?? form.watch('currency');
  const errors = form.formState.errors;

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    const input = accountFormToInput(values, currency);
    const signature = JSON.stringify([target.mode, previous?.id ?? null, values.identifier, values.reconciliationFrom, values.openingBalance]);
    const key = attemptKey(signature);
    try {
      if (previous === null) await runWithProof(proof, () => create.mutateAsync({ input, key }));
      else await runWithProof(proof, () => replace.mutateAsync({ id: previous.id, input, key }));
      notify({ title: previous === null ? 'Compte ajouté' : 'Compte remplacé', description: 'Importez maintenant un premier relevé pour démarrer le pointage.' });
      onClose();
    } catch (error) {
      setFailure(error);
    }
  });

  return (
    <form noValidate className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-4" onSubmit={(event) => { event.stopPropagation(); void submit(event); }}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <FormSelect control={form.control} name="ledgerRole" label="Nature du compte *" placeholder="Choisissez" disabled={previous !== null} options={LEDGER_ROLES.map((value) => ({ value, label: ledgerRoleLabel[value] }))} />
        <TextField label="Nom du compte *" placeholder="ex. Compte courant agence" error={errors.label?.message} {...form.register('label')} data-autofocus />
        <TextField label="Banque" placeholder="ex. Banque Populaire" error={errors.bankName?.message} {...form.register('bankName')} />
        <TextField label="Titulaire *" placeholder="ex. Agence Dupont Immobilier" error={errors.holderName?.message} {...form.register('holderName')} />
        <FormSelect control={form.control} name="identifierKind" label="Type d’identifiant *" placeholder="Choisissez" options={IDENTIFIER_KINDS.map((value) => ({ value, label: value === 'iban' ? 'IBAN' : 'Autre numéro de compte' }))} />
        <TextField label="IBAN ou numéro de compte *" placeholder="ex. FR76 3000 6000 0112 3456 7890 189" autoComplete="off" error={errors.identifier?.message} {...form.register('identifier')} />
        <TextField label="Pays" placeholder="ex. FR" error={errors.country?.message} {...form.register('country')} />
        <TextField label="Suivi à partir du *" type="date" placeholder="AAAA-MM-JJ" error={errors.reconciliationFrom?.message} {...form.register('reconciliationFrom')} />
        <TextField label="Solde d’ouverture *" inputMode="text" placeholder={effectiveCurrency === 'XOF' ? 'ex. 1250000' : 'ex. 1250,50'} hint="Solde de la banque à la veille de la date de début." error={errors.openingBalance?.message} {...form.register('openingBalance')} />
        {currency === null ? (
          <FormSelect control={form.control} name="currency" label="Devise *" placeholder="Choisissez la devise" options={[{ value: 'EUR', label: 'Euro (EUR)' }, { value: 'XOF', label: 'Franc CFA (XOF)' }]} />
        ) : null}
      </div>
      <Controller control={form.control} name="csv" render={({ field }) => <CsvProfileEditor value={field.value} onChange={field.onChange} errors={csvErrorsOf(errors.csv?.columns)} />} />
      {previous !== null && effectiveCurrency !== '' ? <p className="text-caption text-fg-subtle">{`Ancien solde d’ouverture : ${minorToInput(previous.openingBankBalance.amount, previous.currency)}`}</p> : null}
      {failure === null ? null : <ActionError title={previous === null ? 'Compte non ajouté' : 'Compte non remplacé'} error={failure} />}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button type="submit" loading={form.formState.isSubmitting}>{previous === null ? 'Ajouter le compte' : 'Remplacer le compte'}</Button>
      </div>
    </form>
  );
}

function EditForm({ account, proof, onClose }: { account: BankAccount; proof: TwoFactorProof; onClose: () => void }) {
  const update = useUpdateAccount();
  const notify = useNotify();
  const [failure, setFailure] = useState<unknown>(null);
  const form = useBankingForm<EditAccountValues, EditAccountValues>(editAccountSchema, { label: account.label, csv: profileToDraft(account.csvProfile) });
  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      await runWithProof(proof, () => update.mutateAsync({ id: account.id, label: values.label, profile: draftToProfile(values.csv) }));
      notify({ title: 'Compte modifié', description: 'Le profil CSV s’applique aux prochains imports.' });
      onClose();
    } catch (error) {
      setFailure(error);
    }
  });
  return (
    <form noValidate className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-4" onSubmit={(event) => { event.stopPropagation(); void submit(event); }}>
      <TextField label="Nom du compte *" placeholder="ex. Compte courant agence" error={form.formState.errors.label?.message} {...form.register('label')} data-autofocus />
      <Controller control={form.control} name="csv" render={({ field }) => <CsvProfileEditor value={field.value} onChange={field.onChange} errors={csvErrorsOf(form.formState.errors.csv?.columns)} />} />
      {failure === null ? null : <ActionError title="Compte non modifié" error={failure} />}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button type="submit" loading={form.formState.isSubmitting}>Enregistrer</Button>
      </div>
    </form>
  );
}
