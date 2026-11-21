"use client";

import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@eguardimmo/ui";
import type { ReactNode } from "react";
import { formatDay } from "@/lib/dates";
import type { MandatUnit } from "../schemas";

export function MandatUnitsTable({ units, label, actions }: { units: readonly MandatUnit[]; label: string; actions?: (unit: MandatUnit) => ReactNode }) {
  if (units.length === 0) return <p className="py-2 text-body text-fg-subtle">Aucun lot sous mandat.</p>;
  return (
    <Table aria-label={label}>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Lot</TableHeaderCell>
          <TableHeaderCell>Bien</TableHeaderCell>
          <TableHeaderCell>Sous mandat depuis</TableHeaderCell>
          <TableHeaderCell>Jusqu&apos;au</TableHeaderCell>
          {actions ? <TableHeaderCell>Action</TableHeaderCell> : null}
        </TableRow>
      </TableHead>
      <TableBody>
        {units.map((unit) => (
          <TableRow key={unit.id}>
            <TableCell strong>{unit.reference}</TableCell>
            <TableCell>{unit.propertyName || "—"}</TableCell>
            <TableCell>{formatDay(unit.fromIso)}</TableCell>
            <TableCell>{unit.endIso ? formatDay(unit.endIso) : "En cours"}</TableCell>
            {actions ? <TableCell>{actions(unit)}</TableCell> : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
