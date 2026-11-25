"use client";

import { Alert, Badge, EmptyState, Icon } from "@eguardimmo/ui";
import { BookOpen, FileText, ScrollText } from "lucide-react";
import { DataTable, LinkButton, PageFrame } from "@/features/kit";
import type { Column } from "@/features/kit";
import { formatMoney } from "@/features/org/format";
import { QueryBoundary } from "@/features/org/QueryBoundary";
import { useAccounts } from "./hooks";
import { SIDE_LABELS, accountRoleLabel } from "./labels";
import { comptabilitePaths } from "./paths";
import type { Account } from "./schemas";

const COLUMNS: readonly Column<Account>[] = [
  { id: "code", header: "Code", cell: (account) => <span className="tabular-nums">{account.code}</span> },
  { id: "label", header: "Libellé", role: "title", cell: (account) => account.label },
  { id: "role", header: "Nature", cell: (account) => accountRoleLabel(account.role) },
  { id: "side", header: "Sens normal", cell: (account) => <Badge>{SIDE_LABELS[account.normalSide]}</Badge> },
  {
    id: "balance",
    header: "Solde",
    numeric: true,
    cell: (account) =>
      account.balances.length === 0 ? (
        <span className="text-fg-subtle">Aucun mouvement</span>
      ) : (
        <span className="flex flex-col items-end tabular-nums">
          {account.balances.map((balance) => (
            <span key={balance.currency}>{formatMoney(balance)}</span>
          ))}
        </span>
      ),
  },
];

export function AccountsPage() {
  const query = useAccounts();
  return (
    <PageFrame
      crumbs={[{ label: "Finances" }, { label: "Comptabilité" }]}
      title="Comptabilité"
      description="Plan comptable de l’agence et solde de chaque compte, dans le sens normal du compte."
      actions={
        <>
          <LinkButton href={comptabilitePaths.entries} variant="secondary">
            <Icon icon={ScrollText} />
            Écritures
          </LinkButton>
          <LinkButton href={comptabilitePaths.statement} variant="secondary">
            <Icon icon={FileText} />
            Relevé de bail
          </LinkButton>
        </>
      }
    >
      <Alert tone="info" title="Lecture seule">
        Les écritures sont passées par les modules de gestion (loyers, banque, honoraires). Elles ne se modifient ni ne se suppriment : une erreur se corrige par une contre-passation.
      </Alert>
      <QueryBoundary query={query} label="Le plan comptable">
        {(accounts) => (
          <DataTable
            caption="Plan comptable"
            columns={COLUMNS}
            rows={accounts}
            getRowId={(account) => account.id}
            empty={<EmptyState icon={BookOpen} title="Aucun compte" description="Le plan comptable de l’agence n’a pas encore de compte." />}
          />
        )}
      </QueryBoundary>
    </PageFrame>
  );
}
