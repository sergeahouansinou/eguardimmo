"use client";

import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@eguardimmo/ui";
import Link from "next/link";
import { PillBadge } from "@/components/ui/PillBadge";
import { bienHref, locataireHref } from "@/espace/routes";
import { monthName } from "@/lib/dates";
import { formatEurosExact } from "@/lib/money";
import { bienPill } from "../labels";
import { calledMinor, collectedMinor } from "../selectors";
import type { Portefeuille } from "../selectors";
import type { Bien } from "../schemas";

export function LotsTable({ index, biens, label }: { index: Portefeuille; biens: readonly Bien[]; label: string }) {
  if (biens.length === 0) return <p className="py-2 text-body text-fg-subtle">Aucun lot sous mandat.</p>;
  return (
    <Table aria-label={label}>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Lot</TableHeaderCell>
          <TableHeaderCell>Locataire</TableHeaderCell>
          <TableHeaderCell numeric>Loyer charges comprises</TableHeaderCell>
          <TableHeaderCell numeric>{`Encaissé en ${monthName(index.data.todayIso)}`}</TableHeaderCell>
          <TableHeaderCell>État</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {biens.map((bien) => {
          const bail = index.currentBail(bien.id);
          const tenant = bail ? index.locataire(bail.locataireId) : undefined;
          return (
            <TableRow key={bien.id}>
              <TableCell strong>
                <Link href={bienHref(bien.id)} className="hover:underline">
                  {bien.name}
                </Link>
                <span className="block text-caption font-normal text-fg-subtle">{`${bien.kind}, ${String(bien.surfaceM2)} m²`}</span>
              </TableCell>
              <TableCell>
                {tenant ? (
                  <Link href={locataireHref(tenant.id)} className="hover:underline">
                    {tenant.name}
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell numeric>{bail ? formatEurosExact(calledMinor(bail)) : "—"}</TableCell>
              <TableCell numeric>{bail ? formatEurosExact(collectedMinor(bail)) : "—"}</TableCell>
              <TableCell>
                <PillBadge pill={bienPill(bail, index.data.todayIso)} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
