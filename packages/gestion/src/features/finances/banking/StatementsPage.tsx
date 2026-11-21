'use client';

import { Badge, Card, IconButton, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { Ban, Eye } from 'lucide-react';
import { useState } from 'react';
import { useAccounts, useBankingPermissions, useStatements, useVoidStatement } from './hooks';
import { sourceLabel } from './labels';
import type { BankAccount, BankStatement } from './model';
import { BankingGate, BankingSections } from './parts/BankingGate';
import { DownloadIconButton } from './parts/DownloadIconButton';
import { ReasonDialog } from './parts/ReasonDialog';
import { QueryState } from './parts/states';
import { bankingPaths } from './paths';
import { useBankingSource } from './source';
import { CursorPager, useCursorPages } from '../rent/CursorPager';
import { LinkButton, NoRows, PageHeader, useGestionNavigation, useNotify } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';

const ALL = '';

export function StatementsPage() {
  return (
    <BankingGate>
      <StatementsContent />
    </BankingGate>
  );
}

function StatementsContent() {
  const accounts = useAccounts();
  const pages = useCursorPages();
  const [accountId, setAccountId] = useState(ALL);
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Banque' }, { label: 'Relevés' }]}
        title="Relevés importés"
        subtitle="Historique des imports : un import annulé reste visible avec son motif."
        actions={<LinkButton href={bankingPaths.import} variant="primary">Importer un relevé</LinkButton>}
      />
      <BankingSections current="statements" />
      <Card role="region" aria-label="Liste des relevés" className="gap-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Compte" placeholder="Tous les comptes" options={[{ value: ALL, label: 'Tous les comptes' }, ...(accounts.data ?? []).map((account) => ({ value: account.id, label: account.label }))]} value={accountId} onValueChange={(next) => { setAccountId(next); pages.reset(); }} />
        </div>
        <StatementsTable accountId={accountId === ALL ? null : accountId} pages={pages} accounts={accounts.data ?? []} />
      </Card>
    </>
  );
}

function StatementsTable({ accountId, pages, accounts }: { accountId: string | null; pages: ReturnType<typeof useCursorPages>; accounts: readonly BankAccount[] }) {
  const { Link, push } = useGestionNavigation();
  const source = useBankingSource();
  const statements = useStatements(accountId, pages.cursor);
  const [voiding, setVoiding] = useState<BankStatement | null>(null);
  if (statements.data === undefined) return <QueryState query={statements} label="Chargement des relevés" title="Impossible de charger les relevés" />;
  if (statements.data.items.length === 0) return <NoRows>Aucun relevé importé. Importez le premier relevé de la banque pour démarrer le pointage.</NoRows>;
  const accountLabel = (id: string) => accounts.find((account) => account.id === id)?.label ?? 'Compte';
  return (
    <>
      <Table aria-label="Relevés">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Période</TableHeaderCell>
            <TableHeaderCell>Compte</TableHeaderCell>
            <TableHeaderCell>Format</TableHeaderCell>
            <TableHeaderCell numeric>Lignes</TableHeaderCell>
            <TableHeaderCell>Statut</TableHeaderCell>
            <TableHeaderCell>Actions</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {statements.data.items.map((statement) => (
            <TableRow key={statement.id}>
              <TableCell>
                <Link href={bankingPaths.statement(statement.id)} className="font-medium text-action-on-subtle underline-offset-2 hover:underline">{`${formatDateFr(statement.periodFrom)} au ${formatDateFr(statement.periodTo)}`}</Link>
              </TableCell>
              <TableCell>{accountLabel(statement.bankAccountId)}</TableCell>
              <TableCell>{sourceLabel[statement.source]}</TableCell>
              <TableCell numeric>{`${String(statement.linesImported)} / ${String(statement.linesTotal)}`}</TableCell>
              <TableCell>{statement.voidedAt === null ? <Badge tone="success">Importé</Badge> : <Badge tone="neutral">Annulé</Badge>}</TableCell>
              <TableCell>
                <span className="flex items-center gap-1">
                  <IconButton label={`Voir le relevé du ${formatDateFr(statement.periodFrom)}`} icon={Eye} onClick={() => { push(bankingPaths.statement(statement.id)); }} />
                  {statement.hasFile ? <DownloadIconButton label="Télécharger le relevé brut" filename={`releve-${statement.periodFrom}.${statement.source === 'camt053' ? 'xml' : 'csv'}`} failureTitle="Relevé non téléchargé" load={() => source.downloadStatement(statement.id)} /> : null}
                  {statement.voidedAt === null ? <IconButton label={`Annuler l’import du ${formatDateFr(statement.periodFrom)}`} icon={Ban} variant="danger" onClick={() => { setVoiding(statement); }} /> : null}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <CursorPager pages={pages} nextCursor={statements.data.nextCursor} label="Pagination des relevés" />
      <VoidStatementDialog statement={voiding} onClose={() => { setVoiding(null); }} />
    </>
  );
}

export function VoidStatementDialog({ statement, onClose }: { statement: BankStatement | null; onClose: () => void }) {
  const run = useVoidStatement();
  const notify = useNotify();
  const permissions = useBankingPermissions();
  if (!permissions.available) return null;
  return (
    <ReasonDialog
      open={statement !== null}
      title="Annuler cet import ?"
      description="Les lignes du relevé sont retirées du pointage. L’annulation est refusée si une ligne est déjà pointée : défaites d’abord ses pointages."
      confirmLabel="Annuler l’import"
      failureTitle="Import non annulé"
      placeholder="ex. Mauvais compte sélectionné à l’import"
      run={async (reason) => {
        if (statement === null) return;
        await run.mutateAsync({ id: statement.id, reason });
        notify({ title: 'Import annulé', description: 'Le relevé reste consultable avec son motif.' });
      }}
      onClose={onClose}
    />
  );
}
