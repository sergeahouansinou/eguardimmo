'use client';

import { Alert, Button, Card } from '@eguardimmo/ui';
import { useMemo, useState } from 'react';
import { ExpenseFields } from './ExpenseFormFields';
import { useChargesCurrency, useChargesPermissions, useRecordExpense } from './hooks';
import type { ExpenseInput } from './model';
import { ChargesGate } from './parts/ChargesGate';
import { ActionError } from './parts/ActionError';
import { useChargesForm } from './parts/form';
import { chargesPaths } from './paths';
import { allowedSettlements } from './permissions';
import { expenseFormSchema } from './schemas';
import type { ExpenseFormOutput, ExpenseFormValues } from './schemas';
import { useChargesSource } from './source';
import { useAttemptKey } from '../ownerfunds/attemptKey';
import { LinkButton, ListLoading, LoadError, PageHeader, noticeAfterNavigation, useGestionNavigation } from '../../locataires/kit';
import { todayIso } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';
import { useTwoFactorProof } from '../../reauth';
import type { Currency } from '../../../format/money';

const CRUMBS = [{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Dépenses', href: chargesPaths.expenses }, { label: 'Nouvelle dépense' }] as const;

export function ExpenseFormPage() {
  return (
    <ChargesGate>
      <ExpenseFormContent />
    </ChargesGate>
  );
}

function ExpenseFormContent() {
  const currency = useChargesCurrency();
  return (
    <>
      <PageHeader crumbs={CRUMBS} title="Nouvelle dépense" subtitle="Saisissez une facture ou un relevé de l’immeuble. La devise est celle de l’organisation." />
      {currency.isPending ? <ListLoading label="Chargement du formulaire" /> : null}
      {currency.isError ? <LoadError title="Impossible de préparer le formulaire" /> : null}
      {currency.data ? <ExpenseForm currency={currency.data} /> : null}
    </>
  );
}

function toInput(values: ExpenseFormOutput): ExpenseInput {
  return {
    propertyId: values.propertyId,
    unitId: values.unitId,
    kind: values.kind,
    categoryTermId: values.categoryTermId,
    payeeLabel: values.payeeLabel,
    reference: values.reference,
    documentOn: values.documentOn,
    serviceFrom: values.serviceFrom,
    serviceTo: values.serviceTo,
    totalGross: values.totalGross,
    taxAmount: values.taxAmount,
    recoverableAmount: values.recoverableAmount,
    recoverableRubric: values.recoverableRubric,
    settlement: values.settlement,
    paidOn: values.paidOn,
    document: values.document,
  };
}

function signature(input: ExpenseInput): string {
  const { document, ...rest } = input;
  return JSON.stringify({ ...rest, document: document === null ? null : [document.name, document.size, document.lastModified] });
}

function ExpenseForm({ currency }: { currency: Currency }) {
  const permissions = useChargesPermissions();
  const source = useChargesSource();
  const { push } = useGestionNavigation();
  const record = useRecordExpense();
  const attemptKey = useAttemptKey();
  const proof = useTwoFactorProof(source.confirmTwoFactor);
  const [failure, setFailure] = useState<unknown>(null);
  const today = todayIso();
  const schema = useMemo(() => expenseFormSchema({ currency, today }), [currency, today]);
  const defaults: ExpenseFormValues = {
    propertyId: '',
    unitId: '',
    kind: 'payment',
    categoryTermId: '',
    payeeLabel: '',
    reference: '',
    documentOn: today,
    serviceFrom: '',
    serviceTo: '',
    totalGross: '',
    taxAmount: '0',
    recoverableAmount: '0',
    recoverableRubric: '',
    settlement: allowedSettlements(permissions)[0] ?? 'none',
    paidOn: '',
    document: null,
  };
  const form = useChargesForm<ExpenseFormValues, ExpenseFormOutput>(schema, defaults);

  const run = async (values: ExpenseFormOutput): Promise<void> => {
    const input = toInput(values);
    setFailure(null);
    try {
      const expense = await record.mutateAsync({ input, key: attemptKey(signature(input)) });
      noticeAfterNavigation({
        title: expense.status === 'pending_approval' ? 'Dépense en attente de validation' : 'Dépense enregistrée',
        description: expense.status === 'pending_approval' ? 'Un second membre habilité doit la valider avant son écriture.' : 'Elle est disponible pour la régularisation des charges.',
      });
      push(chargesPaths.expense(expense.id));
    } catch (error) {
      if (proof.intercept(error, () => { void run(values); }, () => { setFailure(error); })) return;
      setFailure(error);
    }
  };

  const submit = form.handleSubmit(run);

  return (
    <Card role="region" aria-label="Formulaire de dépense" className="gap-4">
      <form noValidate className="flex flex-col gap-4" onSubmit={(event) => { void submit(event); }}>
        <ExpenseFields control={form.control} register={form.register} setValue={form.setValue} errors={form.formState.errors} currency={currency} permissions={permissions} />
        {Object.keys(form.formState.errors).length > 0 ? <Alert tone="danger" title="Le formulaire contient des erreurs">Corrigez les champs signalés puis enregistrez de nouveau.</Alert> : null}
        {failure === null ? null : <ActionError title="Dépense non enregistrée" error={failure} />}
        <div className="flex flex-wrap justify-end gap-2">
          <LinkButton href={chargesPaths.expenses} variant="ghost">Annuler</LinkButton>
          <Button type="submit" loading={form.formState.isSubmitting || record.isPending}>Enregistrer la dépense</Button>
        </div>
      </form>
      {proof.dialog}
    </Card>
  );
}
