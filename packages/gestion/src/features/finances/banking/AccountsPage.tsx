'use client';

import { Badge, Button, Card, Icon, IconButton, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { Archive, ArrowRightLeft, Pencil, Plus, Upload } from 'lucide-react';
import { useState } from 'react';
import { AccountFormDialog } from './AccountFormDialog';
import type { AccountDialogTarget } from './AccountFormDialog';
import { useAccounts, useBankingPermissions, useCloseAccount } from './hooks';
import { accountStatusBadge, ledgerRoleLabel } from './labels';
import type { BankAccount } from './model';
import { BankingGate, BankingSections } from './parts/BankingGate';
import { ConfirmAction } from './parts/ConfirmAction';
import { runWithProof } from './parts/proof';
import { QueryState } from './parts/states';
import { bankingPaths } from './paths';
import { NoRows, PageHeader, useGestionNavigation, useNotify } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';
import { useBankingSource } from './source';
import { useTwoFactorProof } from '../../reauth';

export function AccountsPage() {
  return (
    <BankingGate>
      <AccountsContent />
    </BankingGate>
  );
}

function AccountsContent() {
  const permissions = useBankingPermissions();
  const accounts = useAccounts();
  const [target, setTarget] = useState<AccountDialogTarget | null>(null);

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Banque' }, { label: 'Comptes bancaires' }]}
        title="Comptes bancaires suivis"
        subtitle="Seuls les quatre derniers caractères de l’IBAN s’affichent : le numéro complet est chiffré."
        actions={
          permissions.manageAccounts ? (
            <Button variant="primary" onClick={() => { setTarget({ mode: 'create' }); }}>
              <Icon icon={Plus} />
              Ajouter un compte
            </Button>
          ) : null
        }
      />
      <BankingSections current="accounts" />
      <Card role="region" aria-label="Liste des comptes" className="gap-3">
        {accounts.data === undefined ? (
          <QueryState query={accounts} label="Chargement des comptes" title="Impossible de charger les comptes" />
        ) : accounts.data.length === 0 ? (
          <NoRows>{permissions.manageAccounts ? 'Aucun compte suivi. Ajoutez le compte bancaire de l’agence pour importer ses relevés.' : 'Aucun compte suivi. Le titulaire ou un administrateur doit ajouter le compte bancaire.'}</NoRows>
        ) : (
          <AccountsTable accounts={accounts.data} onTarget={setTarget} />
        )}
      </Card>
      {permissions.manageAccounts ? <AccountFormDialog target={target} onClose={() => { setTarget(null); }} /> : null}
    </>
  );
}

function AccountsTable({ accounts, onTarget }: { accounts: readonly BankAccount[]; onTarget: (target: AccountDialogTarget) => void }) {
  const { Link, push } = useGestionNavigation();
  const permissions = useBankingPermissions();
  const [closing, setClosing] = useState<BankAccount | null>(null);
  return (
    <>
      <Table aria-label="Comptes bancaires">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Compte</TableHeaderCell>
            <TableHeaderCell>Nature</TableHeaderCell>
            <TableHeaderCell>Titulaire</TableHeaderCell>
            <TableHeaderCell>Suivi depuis</TableHeaderCell>
            <TableHeaderCell>Dernier rapprochement</TableHeaderCell>
            <TableHeaderCell>Statut</TableHeaderCell>
            <TableHeaderCell>Actions</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {accounts.map((account) => {
            const badge = accountStatusBadge[account.status];
            const active = account.status === 'active';
            return (
              <TableRow key={account.id}>
                <TableCell>
                  <Link href={bankingPaths.linesOf(account.id)} className="font-medium text-action-on-subtle underline-offset-2 hover:underline">{account.label}</Link>
                  <span className="block text-caption text-fg-subtle">{`${account.bankName ?? 'Banque non indiquée'} · ••••${account.last4}`}</span>
                </TableCell>
                <TableCell>{ledgerRoleLabel[account.ledgerRole]}</TableCell>
                <TableCell>{account.holderName}</TableCell>
                <TableCell>{formatDateFr(account.reconciliationFrom)}</TableCell>
                <TableCell>{account.lastReconciledOn === null ? 'Jamais' : formatDateFr(account.lastReconciledOn)}</TableCell>
                <TableCell><Badge tone={badge.tone}>{badge.label}</Badge></TableCell>
                <TableCell>
                  <span className="flex items-center gap-1">
                    {active ? <IconButton label={`Importer un relevé pour ${account.label}`} icon={Upload} onClick={() => { push(bankingPaths.importFor(account.id)); }} /> : null}
                    {active && permissions.manageAccounts ? (
                      <>
                        <IconButton label={`Modifier ${account.label}`} icon={Pencil} onClick={() => { onTarget({ mode: 'edit', account }); }} />
                        <IconButton label={`Remplacer ${account.label}`} icon={ArrowRightLeft} onClick={() => { onTarget({ mode: 'replace', account }); }} />
                        <IconButton label={`Fermer ${account.label}`} icon={Archive} variant="danger" onClick={() => { setClosing(account); }} />
                      </>
                    ) : null}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <CloseAccount account={closing} onClose={() => { setClosing(null); }} />
    </>
  );
}

function CloseAccount({ account, onClose }: { account: BankAccount | null; onClose: () => void }) {
  const close = useCloseAccount();
  const source = useBankingSource();
  const proof = useTwoFactorProof(source.confirmTwoFactor);
  const notify = useNotify();
  return (
    <>
      <ConfirmAction
        open={account !== null}
        title="Fermer ce compte ?"
        description="Le compte n’accepte plus de relevés. Son historique et ses états de rapprochement restent consultables. Cette action demande une confirmation de votre double authentification."
        confirmLabel="Fermer le compte"
        failureTitle="Compte non fermé"
        tone="danger"
        run={async () => {
          if (account === null) return;
          await runWithProof(proof, () => close.mutateAsync(account.id));
          notify({ title: 'Compte fermé', description: 'Il reste consultable dans l’historique.' });
        }}
        onClose={onClose}
      />
      {proof.dialog}
    </>
  );
}
