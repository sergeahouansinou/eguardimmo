import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@eguardimmo/ui";
import type { Currency } from "@/lib/currency";
import { formatDay } from "@/lib/dates";
import { formatEuros, formatRate } from "@/lib/money";
import { FEE_BASE_LABELS } from "../feeTerms";
import { feeText } from "../labels";
import type { MandatTerms } from "../schemas";

export function TermsHistoryTable({ terms, currency = "EUR" }: { terms: readonly MandatTerms[]; currency?: Currency }) {
  if (terms.length === 0) return <p className="py-2 text-body text-fg-subtle">Aucune condition enregistrée pour le moment.</p>;
  return (
    <Table aria-label="Historique des conditions du mandat">
      <TableHead>
        <TableRow>
          <TableHeaderCell>Depuis le</TableHeaderCell>
          <TableHeaderCell>Jusqu&apos;au</TableHeaderCell>
          <TableHeaderCell>Honoraires</TableHeaderCell>
          <TableHeaderCell>Base</TableHeaderCell>
          <TableHeaderCell>Minimum</TableHeaderCell>
          <TableHeaderCell>Reversement</TableHeaderCell>
          <TableHeaderCell>Travaux sans accord</TableHeaderCell>
          <TableHeaderCell>Relocation</TableHeaderCell>
          <TableHeaderCell>Suivi de travaux</TableHeaderCell>
          <TableHeaderCell>Nature</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {terms.map((item) => (
          <TableRow key={item.id}>
            <TableCell strong>{formatDay(item.fromIso)}</TableCell>
            <TableCell>{item.toIso ? formatDay(item.toIso) : "En vigueur"}</TableCell>
            <TableCell>{feeText({ feeBasisPoints: item.feeBasisPoints ?? 0, currency, ...(item.flatFeeMinor === undefined ? {} : { flatFeeMinor: item.flatFeeMinor }) }, false)}</TableCell>
            <TableCell>{item.feeBase ? FEE_BASE_LABELS[item.feeBase] : "—"}</TableCell>
            <TableCell>{formatEuros(item.feeMinimumMinor ?? 0, currency)}</TableCell>
            <TableCell>{`Le ${String(item.payoutDay)}`}</TableCell>
            <TableCell>{formatEuros(item.worksLimitMinor, currency)}</TableCell>
            <TableCell>{item.lettingFeeBasisPoints === undefined ? "Non prévue" : formatRate(item.lettingFeeBasisPoints)}</TableCell>
            <TableCell>{item.worksFeeBasisPoints === undefined ? "Non prévu" : formatRate(item.worksFeeBasisPoints)}</TableCell>
            <TableCell>{item.reason === "initial" ? "Conditions initiales" : item.signedFileId === undefined ? "Avenant" : "Avenant signé"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
