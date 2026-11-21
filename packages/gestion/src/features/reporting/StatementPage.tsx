'use client';

import { Alert, Badge, Button, Card, Icon, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, TextField } from '@eguardimmo/ui';
import { FileDown } from 'lucide-react';
import { useState } from 'react';
import { useMandants, useStatement, useStatementCsv } from './hooks';
import { moneyText } from './labels';
import type { Statement } from './model';
import { reportingPaths } from './paths';
import { ActionError, AgencyGate, ReportingSections } from './parts';
import { saveBlob } from '../finances/rent/download';
import { DescriptionList, ListLoading, LoadError, NoRows, PageHeader, useGestionNavigation } from '../locataires/kit';
import { addDays, addMonths, formatDateFr, todayIso } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function StatementPage() {
  return (
    <AgencyGate>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Comptes rendus', href: reportingPaths.reports }, { label: 'Relevé d’un mandant' }]}
        title="Relevé d’un mandant"
        subtitle="Mouvements du compte du mandant sur une période, lus au grand livre. Ce relevé n’est ni numéroté ni figé : il n’a pas valeur de compte rendu."
      />
      <ReportingSections current="statement" />
      <StatementForm />
    </AgencyGate>
  );
}

function StatementForm() {
  const { search } = useGestionNavigation();
  const mandants = useMandants();
  const csv = useStatementCsv();
  const monthStart = `${todayIso().slice(0, 7)}-01`;
  const [mandantId, setMandantId] = useState(search.get('mandant') ?? '');
  const [from, setFrom] = useState(search.get('du') ?? addMonths(monthStart, -1));
  const [to, setTo] = useState(search.get('au') ?? addDays(monthStart, -1));
  const [failure, setFailure] = useState<unknown>(null);
  const valid = mandantId !== '' && DATE_PATTERN.test(from) && DATE_PATTERN.test(to) && from <= to;
  const statement = useStatement(valid ? mandantId : null, valid ? from : null, valid ? to : null);

  const download = async () => {
    setFailure(null);
    try {
      saveBlob(await csv.mutateAsync({ mandantId, from, to }), `releve-mandant-${from}-${to}.csv`);
    } catch (error) {
      setFailure(error);
    }
  };

  return (
    <Card role="region" aria-label="Relevé du compte du mandant" className="gap-3">
      <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          label="Mandant"
          placeholder="Choisir un mandant"
          searchable
          options={(mandants.data ?? []).map((mandant) => ({ value: mandant.partyId, label: mandant.name }))}
          value={mandantId}
          onValueChange={setMandantId}
        />
        <TextField label="Du" type="date" placeholder="AAAA-MM-JJ" value={from} onChange={(event) => { setFrom(event.target.value); }} />
        <TextField label="Au" type="date" placeholder="AAAA-MM-JJ" value={to} error={DATE_PATTERN.test(from) && DATE_PATTERN.test(to) && to < from ? 'La date de fin doit suivre la date de début.' : undefined} onChange={(event) => { setTo(event.target.value); }} />
        <Button variant="secondary" loading={csv.isPending} disabled={!valid} onClick={() => { void download(); }}>
          <Icon icon={FileDown} />
          Exporter (CSV)
        </Button>
      </div>
      {mandants.isError ? <LoadError title={mandants.error?.message ?? 'Les mandants n’ont pas pu être chargés'} /> : null}
      {failure === null ? null : <ActionError title="Export impossible" error={failure} />}
      {!valid ? <NoRows>Choisissez un mandant et une période pour afficher le relevé.</NoRows> : null}
      {valid && statement.isPending && !statement.isError ? <ListLoading label="Chargement du relevé" /> : null}
      {valid && statement.isError ? <LoadError title={statement.error?.message ?? 'Le relevé n’a pas pu être chargé'} /> : null}
      {valid && statement.data ? <StatementTable statement={statement.data} /> : null}
    </Card>
  );
}

function StatementTable({ statement }: { statement: Statement }) {
  return (
    <>
      <DescriptionList
        termWidth="160px"
        items={[
          { term: 'Mandant', detail: statement.mandantName ?? 'Mandant' },
          { term: 'Période', detail: `du ${formatDateFr(statement.from)} au ${formatDateFr(statement.to)}` },
          { term: 'Solde d’ouverture', detail: moneyText(statement.openingBalance) },
          { term: 'Solde de clôture', detail: moneyText(statement.closingBalance) },
        ]}
      />
      {statement.lines.length === 0 ? (
        <Alert tone="info" title="Aucun mouvement">Le compte du mandant n’a pas bougé sur cette période.</Alert>
      ) : (
        <Table aria-label="Mouvements du compte du mandant">
          <TableHead>
            <TableRow>
              <TableHeaderCell>Date</TableHeaderCell>
              <TableHeaderCell>Pièce</TableHeaderCell>
              <TableHeaderCell>Libellé</TableHeaderCell>
              <TableHeaderCell numeric>Débit</TableHeaderCell>
              <TableHeaderCell numeric>Crédit</TableHeaderCell>
              <TableHeaderCell numeric>Solde</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {statement.lines.map((line, index) => (
              <TableRow key={`${line.date}-${String(index)}`}>
                <TableCell>{formatDateFr(line.date)}</TableCell>
                <TableCell>{line.reference ?? '—'}</TableCell>
                <TableCell>
                  {line.label}
                  {line.isReversal ? <>{' '}<Badge tone="warning">Contrepassation</Badge></> : null}
                </TableCell>
                <TableCell numeric>{line.debit.amount === 0 ? '—' : moneyText(line.debit)}</TableCell>
                <TableCell numeric>{line.credit.amount === 0 ? '—' : moneyText(line.credit)}</TableCell>
                <TableCell numeric>{moneyText(line.balance)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
