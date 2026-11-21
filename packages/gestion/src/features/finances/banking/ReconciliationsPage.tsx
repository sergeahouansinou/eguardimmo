'use client';

import { Badge, Button, Card, Icon, IconButton, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, TextField } from '@eguardimmo/ui';
import { Calculator, Eye } from 'lucide-react';
import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { useAccounts, useBankingPermissions, useBuildReconciliation, useReconciliations } from './hooks';
import { moneyText, reconciliationStatusBadge } from './labels';
import type { BankAccount } from './model';
import { parseMinor } from './money';
import { ActionError } from './parts/ActionError';
import { BankingGate, BankingSections } from './parts/BankingGate';
import { useBankingForm } from './parts/form';
import { QueryState } from './parts/states';
import { bankingPaths } from './paths';
import { reconciliationFormSchema } from './schemas';
import type { ReconciliationFormValues } from './schemas';
import { CursorPager, useCursorPages } from '../rent/CursorPager';
import { FilePicker, NoRows, PageHeader, useGestionNavigation } from '../../locataires/kit';
import { addMonths, monthLabel, todayIso } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';
import { useAttemptKey } from '../ownerfunds/attemptKey';

const ALL = '';
const PROOF_ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const PROOF_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'] as const;

function proofProblem(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!PROOF_EXTENSIONS.some((extension) => name.endsWith(extension))) return 'Format non pris en charge : PDF, JPEG ou PNG.';
  if (file.size > MAX_PROOF_BYTES) return 'Fichier trop volumineux : 10 Mo au maximum.';
  return null;
}

export function ReconciliationsPage() {
  return (
    <BankingGate>
      <ReconciliationsContent />
    </BankingGate>
  );
}

function ReconciliationsContent() {
  const accounts = useAccounts();
  const pages = useCursorPages();
  const [accountId, setAccountId] = useState(ALL);
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Banque' }, { label: 'États de rapprochement' }]}
        title="États de rapprochement"
        subtitle="Un état par compte et par mois : il compare le solde de la banque au grand livre et doit être validé pour clôturer les fonds des mandants."
      />
      <BankingSections current="reconciliations" />
      {accounts.data === undefined ? (
        <QueryState query={accounts} label="Chargement des comptes" title="Impossible de charger les comptes" />
      ) : (
        <>
          <BuildForm accounts={accounts.data.filter((account) => account.status === 'active')} />
          <Card role="region" aria-label="Liste des états" className="gap-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Select label="Compte" placeholder="Tous les comptes" options={[{ value: ALL, label: 'Tous les comptes' }, ...accounts.data.map((account) => ({ value: account.id, label: account.label }))]} value={accountId} onValueChange={(next) => { setAccountId(next); pages.reset(); }} />
            </div>
            <ReconciliationsTable accountId={accountId === ALL ? null : accountId} pages={pages} accounts={accounts.data} />
          </Card>
        </>
      )}
    </>
  );
}

function ReconciliationsTable({ accountId, pages, accounts }: { accountId: string | null; pages: ReturnType<typeof useCursorPages>; accounts: readonly BankAccount[] }) {
  const { Link, push } = useGestionNavigation();
  const list = useReconciliations(accountId, pages.cursor);
  if (list.data === undefined) return <QueryState query={list} label="Chargement des états" title="Impossible de charger les états" />;
  if (list.data.items.length === 0) return <NoRows>Aucun état de rapprochement. Calculez le premier ci-dessus.</NoRows>;
  return (
    <>
      <Table aria-label="États de rapprochement">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Mois</TableHeaderCell>
            <TableHeaderCell>Compte</TableHeaderCell>
            <TableHeaderCell numeric>Solde bancaire</TableHeaderCell>
            <TableHeaderCell numeric>Écart inexpliqué</TableHeaderCell>
            <TableHeaderCell>Statut</TableHeaderCell>
            <TableHeaderCell>Actions</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {list.data.items.map((item) => {
            const badge = reconciliationStatusBadge[item.status];
            return (
              <TableRow key={item.id}>
                <TableCell>
                  <Link href={bankingPaths.reconciliation(item.id)} className="font-medium text-action-on-subtle underline-offset-2 hover:underline">{monthLabel(item.asOf.slice(0, 7))}</Link>
                </TableCell>
                <TableCell>{accounts.find((account) => account.id === item.bankAccountId)?.label ?? 'Compte'}</TableCell>
                <TableCell numeric>{moneyText(item.bankBalance)}</TableCell>
                <TableCell numeric>{moneyText(item.unexplainedDifference, { signed: true })}</TableCell>
                <TableCell><Badge tone={badge.tone}>{badge.label}</Badge></TableCell>
                <TableCell><IconButton label={`Voir l’état de ${monthLabel(item.asOf.slice(0, 7))}`} icon={Eye} onClick={() => { push(bankingPaths.reconciliation(item.id)); }} /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <CursorPager pages={pages} nextCursor={list.data.nextCursor} label="Pagination des états" />
    </>
  );
}

function BuildForm({ accounts }: { accounts: readonly BankAccount[] }) {
  const { push } = useGestionNavigation();
  const permissions = useBankingPermissions();
  const build = useBuildReconciliation();
  const attemptKey = useAttemptKey();
  const [failure, setFailure] = useState<unknown>(null);
  const first = accounts[0];
  const form = useBankingForm<ReconciliationFormValues, ReconciliationFormValues>(reconciliationFormSchema, {
    accountId: accounts.length === 1 && first ? first.id : '',
    month: addMonths(todayIso().slice(0, 7) + '-01', -1).slice(0, 7),
    enteredBalance: '',
    proof: null,
    currency: first?.currency ?? 'EUR',
  });
  const errors = form.formState.errors;
  if (!permissions.available || accounts.length === 0) return null;

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    const account = accounts.find((item) => item.id === values.accountId);
    const currency = account?.currency ?? values.currency;
    const balance = values.enteredBalance === '' ? null : parseMinor(values.enteredBalance, currency, { signed: true });
    const signature = JSON.stringify([values.accountId, values.month, balance, values.proof?.name ?? null, values.proof?.size ?? null]);
    try {
      const created = await build.mutateAsync({ input: { accountId: values.accountId, month: values.month, bankBalance: balance, proof: values.proof }, key: attemptKey(signature) });
      push(bankingPaths.reconciliation(created.id));
    } catch (error) {
      setFailure(error);
    }
  });

  return (
    <Card role="region" aria-label="Calculer un état" className="gap-3">
      <h2 className="text-section-title">Calculer un état</h2>
      <form noValidate className="flex flex-col gap-3" onSubmit={(event) => { event.stopPropagation(); void submit(event); }}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Controller control={form.control} name="accountId" render={({ field, fieldState }) => (
            <Select label="Compte *" placeholder="Choisissez le compte" options={accounts.map((item) => ({ value: item.id, label: `${item.label} · ••••${item.last4}` }))} value={field.value} error={fieldState.error?.message} onValueChange={(next) => { field.onChange(next); const target = accounts.find((item) => item.id === next); if (target) form.setValue('currency', target.currency); }} />
          )} />
          <TextField label="Mois *" type="month" placeholder="AAAA-MM" error={errors.month?.message} {...form.register('month')} />
          <TextField label="Solde saisi (facultatif)" placeholder={form.watch('currency') === 'XOF' ? 'ex. 1250000' : 'ex. 1250,50'} hint="À renseigner seulement sans relevé couvrant la fin du mois." error={errors.enteredBalance?.message} {...form.register('enteredBalance')} />
        </div>
        {form.watch('enteredBalance') === '' ? null : (
          <Controller control={form.control} name="proof" render={({ field, fieldState }) => (
            <FilePicker label="Pièce justificative du solde *" hint="Relevé de la banque en PDF, JPEG ou PNG, 10 Mo au maximum" accept={PROOF_ACCEPT} validate={proofProblem} file={field.value} error={fieldState.error?.message} onFile={field.onChange} />
          )} />
        )}
        {failure === null ? null : <ActionError title="État non calculé" error={failure} />}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={form.formState.isSubmitting}>
            <Icon icon={Calculator} />
            Calculer l’état
          </Button>
        </div>
      </form>
    </Card>
  );
}
