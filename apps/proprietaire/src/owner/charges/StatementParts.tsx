import { Badge } from "@eguardimmo/ui";
import { NOT_AVAILABLE, formatMoney, formatOptionalDay, labelOf } from "../format";
import { STATEMENT_STATUS, readBalance } from "./labels";
import type { OwnerStatement } from "./model";
import type { BalanceKind } from "./labels";

const BALANCE_TONE: Readonly<Record<BalanceKind, string>> = { due: "text-warning-fg", refund: "text-success-fg", settled: "text-fg" };

export function StatementStatusBadge({ status }: { status: string }) {
  const entry = STATEMENT_STATUS[status];
  return <Badge tone={entry?.tone ?? "neutral"}>{entry?.label ?? labelOf({}, status)}</Badge>;
}

export function BalanceText({ balance }: { balance: OwnerStatement["balance"] }) {
  const reading = readBalance(balance);
  return (
    <span className={BALANCE_TONE[reading.kind]}>
      {reading.kind === "settled" ? reading.label : `${reading.label} : ${formatMoney(reading.amount)}`}
    </span>
  );
}

export const statementTitle = (statement: Pick<OwnerStatement, "number">): string => `Décompte ${statement.number ?? NOT_AVAILABLE}`;

export function unitLabel(statement: Pick<OwnerStatement, "unitReference" | "propertyName">): string {
  const parts = [statement.unitReference, statement.propertyName].filter((part): part is string => part !== null && part !== "");
  return parts.length === 0 ? NOT_AVAILABLE : parts.join(" · ");
}

export function tenantsLabel(names: readonly string[]): string {
  return names.length === 0 ? NOT_AVAILABLE : names.join(", ");
}

export const issuedDay = (statement: Pick<OwnerStatement, "issuedAt">): string => formatOptionalDay(statement.issuedAt === null ? null : statement.issuedAt.slice(0, 10));
