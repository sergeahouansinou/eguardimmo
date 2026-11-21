'use client';

import { Button, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { useState } from 'react';
import { formatMoney } from '../../format/money';
import { formatDateFr } from '../locataires/kit/dates';
import type { Schedule } from './model';

const FIRST_LINES = 24;

export function ScheduleTable({ schedule }: { schedule: Schedule }) {
  const [all, setAll] = useState(false);
  const lines = all ? schedule.lines : schedule.lines.slice(0, FIRST_LINES);
  const money = (value: { amount: number; currency: typeof schedule.currency }) => formatMoney(value.amount, value.currency);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Table scrollLabel="Tableau d’amortissement, défilement horizontal">
        <TableHead>
          <TableRow>
            <TableHeaderCell numeric>N°</TableHeaderCell>
            <TableHeaderCell>Échéance</TableHeaderCell>
            <TableHeaderCell numeric>Mensualité, assurance incluse</TableHeaderCell>
            <TableHeaderCell numeric>Intérêts</TableHeaderCell>
            <TableHeaderCell numeric>Capital</TableHeaderCell>
            <TableHeaderCell numeric>Assurance</TableHeaderCell>
            <TableHeaderCell numeric>Restant dû après échéance</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {lines.map((line) => (
            <TableRow key={line.position}>
              <TableCell numeric>{line.position}</TableCell>
              <TableCell>{formatDateFr(line.dueOn)}</TableCell>
              <TableCell numeric>{money(line.total)}</TableCell>
              <TableCell numeric>{money(line.interest)}</TableCell>
              <TableCell numeric>{money(line.principal)}</TableCell>
              <TableCell numeric>{money(line.insurance)}</TableCell>
              <TableCell numeric>{money(line.outstandingAfter)}</TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell strong>Totaux</TableCell>
            <TableCell>{`${String(schedule.lines.length)} échéances`}</TableCell>
            <TableCell numeric>{''}</TableCell>
            <TableCell numeric strong>{money(schedule.totals.interest)}</TableCell>
            <TableCell numeric strong>{money(schedule.totals.principal)}</TableCell>
            <TableCell numeric strong>{money(schedule.totals.insurance)}</TableCell>
            <TableCell numeric>{''}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      {schedule.lines.length > FIRST_LINES ? (
        <div>
          <Button variant="secondary" size="sm" onClick={() => { setAll(!all); }}>
            {all ? 'Réduire le tableau' : `Afficher les ${String(schedule.lines.length)} échéances`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
