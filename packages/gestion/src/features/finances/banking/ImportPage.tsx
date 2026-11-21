'use client';

import { Alert, Button, Card, Icon, Select } from '@eguardimmo/ui';
import { Eye, Upload } from 'lucide-react';
import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { CsvProfileEditor, csvErrorsOf } from './CsvProfileEditor';
import { ImportPreview, RejectedList } from './ImportPreview';
import { useAccounts, useImportStatement, usePreviewStatement } from './hooks';
import { sourceLabel } from './labels';
import { IMPORT_FORMATS } from './model';
import type { BankAccount, ImportFormat, ImportResult, StatementPreview } from './model';
import { ActionError } from './parts/ActionError';
import { BankingGate, BankingSections } from './parts/BankingGate';
import { useBankingForm } from './parts/form';
import { QueryState } from './parts/states';
import { bankingPaths } from './paths';
import { defaultCsvDraft, draftToProfile, formatOfFile, importFileProblem, importFormSchema, profileToDraft } from './schemas';
import type { ImportFormValues } from './schemas';
import { FilePicker, LinkButton, PageHeader, useGestionNavigation } from '../../locataires/kit';
import { links } from '../../locataires/kit/links';
import { useAttemptKey } from '../ownerfunds/attemptKey';

export function ImportPage() {
  return (
    <BankingGate>
      <ImportContent />
    </BankingGate>
  );
}

function ImportContent() {
  const accounts = useAccounts();
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Banque' }, { label: 'Importer un relevé' }]}
        title="Importer un relevé"
        subtitle="Fichier CSV ou camt.053 (XML), 10 Mo au maximum. Un aperçu vous est montré avant tout enregistrement."
      />
      <BankingSections current="statements" />
      {accounts.data === undefined ? (
        <QueryState query={accounts} label="Chargement des comptes" title="Impossible de charger les comptes" />
      ) : (
        <ImportForm accounts={accounts.data.filter((account) => account.status === 'active')} />
      )}
    </>
  );
}

function pickFormat(value: string, fallback: ImportFormat): ImportFormat {
  return IMPORT_FORMATS.find((format) => format === value) ?? fallback;
}

function ImportForm({ accounts }: { accounts: readonly BankAccount[] }) {
  const { search } = useGestionNavigation();
  const preview = usePreviewStatement();
  const run = useImportStatement();
  const attemptKey = useAttemptKey();
  const [previewed, setPreviewed] = useState<StatementPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const wanted = search.get('compte');
  const initial = accounts.find((account) => account.id === wanted) ?? (accounts.length === 1 ? accounts[0] : undefined);
  const form = useBankingForm<ImportFormValues, ImportFormValues>(importFormSchema, {
    accountId: initial?.id ?? '',
    file: null,
    format: 'csv',
    csv: initial?.csvProfile ? profileToDraft(initial.csvProfile) : defaultCsvDraft(),
  });
  const accountId = form.watch('accountId');
  const format = form.watch('format');
  const account = accounts.find((item) => item.id === accountId);
  const ownProfile = account?.csvProfile ?? null;
  const errors = form.formState.errors;

  const reset = () => {
    setPreviewed(null);
    setResult(null);
    setFailure(null);
  };

  const profileOf = (values: ImportFormValues): ReturnType<typeof draftToProfile> => {
    if (values.format !== 'csv') return null;
    return ownProfile !== null && !values.csv.enabled ? null : draftToProfile({ ...values.csv, enabled: true });
  };

  const showPreview = form.handleSubmit(async (values) => {
    reset();
    if (values.file === null) return;
    try {
      setPreviewed(await preview.mutateAsync({ accountId: values.accountId, file: values.file, format: values.format, profile: profileOf(values) }));
    } catch (error) {
      setFailure(error);
    }
  });

  const confirm = form.handleSubmit(async (values) => {
    setFailure(null);
    if (values.file === null) return;
    const signature = JSON.stringify([values.accountId, values.format, values.file.name, values.file.size, values.file.lastModified]);
    try {
      setResult(await run.mutateAsync({ accountId: values.accountId, file: values.file, format: values.format, profile: profileOf(values), key: attemptKey(signature) }));
    } catch (error) {
      setFailure(error);
    }
  });

  if (accounts.length === 0) {
    return (
      <Alert tone="info" title="Aucun compte actif">
        Ajoutez d’abord un compte bancaire pour importer ses relevés.
        <span className="mt-2 block"><LinkButton href={bankingPaths.accounts}>Ouvrir les comptes bancaires</LinkButton></span>
      </Alert>
    );
  }

  if (result !== null) return <ImportDone result={result} accountId={accountId} onAgain={() => { form.reset({ ...form.getValues(), file: null }); reset(); }} />;

  return (
    <Card role="region" aria-label="Import d’un relevé" className="gap-3">
      <form noValidate className="flex flex-col gap-3" onSubmit={(event) => { event.stopPropagation(); void showPreview(event); }}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Controller control={form.control} name="accountId" render={({ field, fieldState }) => (
            <Select label="Compte *" placeholder="Choisissez le compte" options={accounts.map((item) => ({ value: item.id, label: `${item.label} · ••••${item.last4}` }))} value={field.value} error={fieldState.error?.message} onValueChange={(next) => { field.onChange(next); reset(); const target = accounts.find((item) => item.id === next); form.setValue('csv', target?.csvProfile ? profileToDraft(target.csvProfile) : defaultCsvDraft()); }} />
          )} />
          <Controller control={form.control} name="format" render={({ field }) => (
            <Select label="Format du fichier *" placeholder="Choisissez" options={IMPORT_FORMATS.map((item) => ({ value: item, label: item === 'csv' ? 'CSV' : `${sourceLabel.camt053} (XML)` }))} value={field.value} onValueChange={(next) => { field.onChange(pickFormat(next, field.value)); reset(); }} />
          )} />
        </div>
        <Controller control={form.control} name="file" render={({ field, fieldState }) => (
          <FilePicker label="Fichier du relevé *" hint="CSV, TXT ou XML camt.053, 10 Mo au maximum" accept=".csv,.txt,.xml,text/csv,text/xml,application/xml" validate={importFileProblem} file={field.value} error={fieldState.error?.message} onFile={(file) => { field.onChange(file); reset(); if (file !== null) form.setValue('format', formatOfFile(file)); }} />
        )} />
        {format === 'csv' ? (
          <Controller control={form.control} name="csv" render={({ field }) => (
            <CsvProfileEditor
              optional={ownProfile !== null}
              value={ownProfile === null ? { ...field.value, enabled: true } : field.value}
              onChange={field.onChange}
              errors={csvErrorsOf(errors.csv?.columns)}
            />
          )} />
        ) : null}
        {ownProfile !== null && format === 'csv' && !form.watch('csv').enabled ? <p className="text-caption text-fg-subtle">Le profil CSV enregistré sur ce compte sera utilisé.</p> : null}
        {failure === null ? null : <ActionError title="Relevé non importé" error={failure} />}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="submit" variant={previewed === null ? 'primary' : 'secondary'} loading={preview.isPending}>
            <Icon icon={Eye} />
            Voir l’aperçu
          </Button>
        </div>
      </form>
      {previewed === null ? null : (
        <>
          <ImportPreview preview={previewed} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="primary" loading={run.isPending} onClick={() => { void confirm(); }}>
              <Icon icon={Upload} />
              {`Importer ${String(previewed.wouldImport)} ligne${previewed.wouldImport > 1 ? 's' : ''}`}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

function ImportDone({ result, accountId, onAgain }: { result: ImportResult; accountId: string; onAgain: () => void }) {
  const { statement } = result;
  return (
    <Card role="region" aria-label="Résultat de l’import" className="gap-3">
      <Alert tone="success" title="Relevé importé">
        {`${String(statement.linesImported)} ligne${statement.linesImported > 1 ? 's' : ''} importée${statement.linesImported > 1 ? 's' : ''}, ${String(statement.linesDuplicated)} doublon${statement.linesDuplicated > 1 ? 's' : ''} ignoré${statement.linesDuplicated > 1 ? 's' : ''}, ${String(statement.linesRejected)} refusée${statement.linesRejected > 1 ? 's' : ''}. Le calcul des propositions de pointage démarre.`}
      </Alert>
      <RejectedList rejected={result.rejected} total={statement.linesRejected} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onAgain}>Importer un autre relevé</Button>
        <LinkButton href={bankingPaths.linesAfterImport(accountId)} variant="primary">Pointer les lignes</LinkButton>
      </div>
    </Card>
  );
}
