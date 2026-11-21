'use client';

import { Alert, Button, Card, EmptyState, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, TextField } from '@eguardimmo/ui';
import { CalendarCheck } from 'lucide-react';
import { useState } from 'react';
import { CLOSING_WARNING_MESSAGES } from './api/ownerFundsErrors';
import { useAttemptKey } from './attemptKey';
import { useCloseMonth, useOwnerFundsPermissions, usePeriods } from './hooks';
import type { CloseResult } from './model';
import { ConfirmAction, OwnerFundsGate, OwnerFundsSections, RoleNotice } from './parts';
import { ListLoading, LoadError, PageHeader } from '../../locataires/kit';
import { addMonths, formatDateFr, monthLabel, todayIso } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function ClosingPage() {
  return (
    <OwnerFundsGate>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Clôture mensuelle' }]}
        title="Clôture mensuelle"
        subtitle="Un mois clos est immuable. Les mois se clôturent dans l’ordre, du plus ancien au plus récent, sans réouverture."
      />
      <OwnerFundsSections current="closing" />
      <ClosingCard />
    </OwnerFundsGate>
  );
}

function ClosingCard() {
  const permissions = useOwnerFundsPermissions();
  const periods = usePeriods();
  const close = useCloseMonth();
  const keyFor = useAttemptKey();
  const [chosen, setChosen] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<CloseResult | null>(null);

  const rows = periods.data ?? [];
  const latest = rows[0]?.month;
  const suggested = latest ? addMonths(`${latest}-01`, 1).slice(0, 7) : addMonths(`${todayIso().slice(0, 7)}-01`, -1).slice(0, 7);
  const month = chosen ?? suggested;
  const valid = MONTH_PATTERN.test(month);

  return (
    <>
      {result ? (
        <Alert tone="success" title={`${monthLabel(result.period.month)} est clos`}>
          {result.warnings.length === 0 ? 'Aucun avertissement.' : null}
          {result.warnings.length > 0 ? (
            <ul className="list-disc pl-5">
              {result.warnings.map((warning) => (
                <li key={warning}>{CLOSING_WARNING_MESSAGES[warning] ?? warning}</li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}
      {permissions.sensitive ? (
        <Card role="region" aria-label="Clôturer un mois" className="gap-3">
          <h2 className="text-block-title text-fg">Clôturer un mois</h2>
          <p className="text-body text-fg-muted">
            Le serveur vérifie le grand livre, la couverture du cantonnement et les virements en cours ; un contrôle bloquant refuse la clôture et en donne les motifs.
          </p>
          <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <TextField label="Mois à clôturer" type="month" placeholder="AAAA-MM" value={month} onChange={(event) => { setChosen(event.target.value); }} error={valid ? undefined : 'Choisissez un mois.'} />
            <Button disabled={!valid || periods.isPending} onClick={() => { setConfirming(true); }}>Clôturer ce mois</Button>
          </div>
        </Card>
      ) : (
        <RoleNotice>La clôture d’un mois est réservée au propriétaire, à l’administrateur et au comptable, avec double authentification.</RoleNotice>
      )}
      <Card role="region" aria-label="Mois clos" className="gap-3">
        <h2 className="text-block-title text-fg">Mois clos</h2>
        {periods.isError ? <LoadError title={periods.error?.message ?? 'Les mois clos n’ont pas pu être chargés'} /> : null}
        {periods.isPending && !periods.isError ? <ListLoading label="Chargement des mois clos" /> : null}
        {periods.data && rows.length === 0 ? <EmptyState icon={CalendarCheck} title="Aucun mois clos" description="Le plus ancien mois ouvert est le premier à clôturer." /> : null}
        {rows.length > 0 ? (
          <Table aria-label="Mois clos">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Mois</TableHeaderCell>
                <TableHeaderCell>Clos le</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((period) => (
                <TableRow key={period.id}>
                  <TableCell strong>{monthLabel(period.month)}</TableCell>
                  <TableCell>{formatDateFr(period.closedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </Card>
      <ConfirmAction
        open={confirming}
        title={`Clôturer ${valid ? monthLabel(month) : 'ce mois'} ?`}
        description="Cette clôture est définitive : plus aucune écriture ne pourra être passée dans ce mois. Une erreur découverte après coup se corrige par une écriture rectificative dans le mois ouvert."
        confirmLabel="Clôturer le mois"
        failureTitle="Mois non clos"
        tone="danger"
        onClose={() => { setConfirming(false); }}
        run={async () => {
          setResult(null);
          setResult(await close.mutateAsync({ month, key: keyFor(`close:${month}`) }));
          setChosen(null);
        }}
      />
    </>
  );
}
