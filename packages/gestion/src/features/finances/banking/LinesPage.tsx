'use client';

import { Alert, Button, Card, Icon, Select, Tab, TabList, TabPanel, Tabs, TextField } from '@eguardimmo/ui';
import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AcceptDialog, AcceptSummary, RestoreDialog, UndoDialog } from './LineDialogs';
import { IgnoreDialog } from './IgnoreDialog';
import { LinesTable, isAcceptable } from './LinesTable';
import type { LineAction } from './LinesTable';
import { MatchDialog } from './MatchDialog';
import { SettleDialog } from './SettleDialog';
import { useAccounts, useLines, useRefreshBanking } from './hooks';
import { lineStateLabel } from './labels';
import { DIRECTIONS, LINE_STATES } from './model';
import type { AcceptResult, BankAccount, BankLine, Direction, LineState } from './model';
import { BankingGate, BankingSections } from './parts/BankingGate';
import { QueryState } from './parts/states';
import { bankingPaths } from './paths';
import { CursorPager, useCursorPages } from '../rent/CursorPager';
import { LinkButton, NoRows, PageHeader, useGestionNavigation } from '../../locataires/kit';
import { links } from '../../locataires/kit/links';
import { useBankingPermissions } from './hooks';

const POLL_MS = 5000;
const POLL_WINDOW_MS = 90_000;
const MAX_ACCEPT = 50;
const ANY = '';

export function LinesPage() {
  return (
    <BankingGate>
      <LinesContent />
    </BankingGate>
  );
}

function LinesContent() {
  const accounts = useAccounts();
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Banque' }, { label: 'Pointage' }]}
        title="Pointage bancaire"
        subtitle="Rapprochez chaque ligne du relevé avec un encaissement, une facture ou une écriture. Rien n’est validé sans votre accord."
        actions={<LinkButton href={bankingPaths.import} variant="primary">Importer un relevé</LinkButton>}
      />
      <BankingSections current="lines" />
      {accounts.data === undefined ? (
        <QueryState query={accounts} label="Chargement des comptes" title="Impossible de charger les comptes" />
      ) : accounts.data.length === 0 ? (
        <NoRows>Aucun compte suivi. Ajoutez un compte bancaire puis importez un relevé.</NoRows>
      ) : (
        <LinesWorkspace accounts={accounts.data} />
      )}
    </>
  );
}

function pickDirection(value: string): Direction | null {
  return DIRECTIONS.find((direction) => direction === value) ?? null;
}

function LinesWorkspace({ accounts }: { accounts: readonly BankAccount[] }) {
  const { search } = useGestionNavigation();
  const permissions = useBankingPermissions();
  const refresh = useRefreshBanking();
  const pages = useCursorPages();
  const wanted = search.get('compte');
  const [accountId, setAccountId] = useState(accounts.find((account) => account.id === wanted)?.id ?? accounts.find((account) => account.status === 'active')?.id ?? accounts[0]?.id ?? '');
  const [state, setState] = useState<LineState>('unmatched');
  const [direction, setDirection] = useState(ANY);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [polling, setPolling] = useState(search.get('calcul') === '1');
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [accepting, setAccepting] = useState<readonly BankLine[] | null>(null);
  const [dialog, setDialog] = useState<{ action: Exclude<LineAction, 'accept'>; line: BankLine } | null>(null);
  const [summary, setSummary] = useState<AcceptResult | null>(null);
  const account = accounts.find((item) => item.id === accountId);
  const writable = permissions.available && account?.status === 'active';

  useEffect(() => {
    if (!polling) return undefined;
    const timer = setTimeout(() => { setPolling(false); }, POLL_WINDOW_MS);
    return () => { clearTimeout(timer); };
  }, [polling]);

  const lines = useLines(
    { accountId, state, cursor: pages.cursor, direction: pickDirection(direction), from: from === '' ? null : from, to: to === '' ? null : to },
    { enabled: accountId !== '', pollMs: polling && state === 'unmatched' ? POLL_MS : false },
  );
  const items = lines.data?.items ?? [];
  const waiting = state === 'unmatched' && items.some((line) => line.suggestion === null);

  const resetView = () => {
    pages.reset();
    setSelected([]);
  };
  const toggle = (lineId: string) => {
    setSelected((current) => (current.includes(lineId) ? current.filter((id) => id !== lineId) : current.length >= MAX_ACCEPT ? current : [...current, lineId]));
  };
  const onAction = (action: LineAction, line: BankLine) => {
    if (action === 'accept') setAccepting([line]);
    else setDialog({ action, line });
  };
  const dialogLine = (action: Exclude<LineAction, 'accept'>): BankLine | null => (dialog?.action === action ? dialog.line : null);
  const closeDialog = () => { setDialog(null); };
  const chosen = items.filter((line) => selected.includes(line.id) && isAcceptable(line));

  return (
    <>
      <Card role="region" aria-label="Lignes du relevé" className="gap-3">
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Compte" placeholder="Choisissez le compte" options={accounts.map((item) => ({ value: item.id, label: `${item.label} · ••••${item.last4}` }))} value={accountId} onValueChange={(next) => { setAccountId(next); resetView(); }} />
          <Select label="Sens" placeholder="Tous les sens" options={[{ value: ANY, label: 'Tous les sens' }, { value: 'credit', label: 'Encaissements' }, { value: 'debit', label: 'Décaissements' }]} value={direction} onValueChange={(next) => { setDirection(next); resetView(); }} />
          <TextField label="À partir du" type="date" placeholder="AAAA-MM-JJ" value={from} onChange={(event) => { setFrom(event.target.value); resetView(); }} />
          <TextField label="Jusqu’au" type="date" placeholder="AAAA-MM-JJ" value={to} onChange={(event) => { setTo(event.target.value); resetView(); }} />
        </div>
        <Tabs value={state} defaultValue="unmatched" onValueChange={(next) => { setState(LINE_STATES.find((value) => value === next) ?? 'unmatched'); resetView(); }}>
          <TabList aria-label="État des lignes">
            {LINE_STATES.map((value) => (
              <Tab key={value} value={value}>{lineStateLabel[value]}</Tab>
            ))}
          </TabList>
          <TabPanel value={state} className="flex flex-col gap-3">
        {account?.status === 'closed' ? <Alert tone="info" title="Compte fermé">Ce compte est fermé : ses lignes sont en lecture seule.</Alert> : null}
        {polling && waiting ? <Alert tone="info" title="Calcul des propositions en cours">Les propositions arrivent au fil de l’eau, cette page se met à jour toute seule.</Alert> : null}
        {summary === null ? null : <AcceptSummary result={summary} onDismiss={() => { setSummary(null); }} />}
        {state === 'unmatched' && writable ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setPolling(true); void refresh(); }}>
              <Icon icon={RefreshCw} />
              Actualiser les propositions
            </Button>
            <Button variant="primary" size="sm" disabled={chosen.length === 0} onClick={() => { setAccepting(chosen); }}>
              {chosen.length === 0 ? 'Valider les propositions choisies' : `Valider ${String(chosen.length)} proposition${chosen.length > 1 ? 's' : ''}`}
            </Button>
          </div>
        ) : null}
        {lines.data === undefined ? (
          <QueryState query={lines} label="Chargement des lignes" title="Impossible de charger les lignes" />
        ) : items.length === 0 ? (
          <NoRows>{state === 'unmatched' ? 'Aucune ligne à pointer. Importez un relevé ou élargissez les filtres.' : 'Aucune ligne dans cet état.'}</NoRows>
        ) : (
          <>
            <LinesTable lines={items} state={state} selected={selected} writable={writable} onToggle={toggle} onAction={onAction} />
            <CursorPager pages={pages} nextCursor={lines.data.nextCursor} label="Pagination des lignes" />
          </>
        )}
          </TabPanel>
        </Tabs>
      </Card>
      <AcceptDialog lines={accepting} onDone={(result) => { setSummary(result); setSelected([]); }} onClose={() => { setAccepting(null); }} />
      <MatchDialog line={dialogLine('match')} onClose={closeDialog} />
      <SettleDialog line={dialogLine('settle')} onClose={closeDialog} />
      <IgnoreDialog line={dialogLine('ignore')} account={account} onClose={closeDialog} />
      <UndoDialog line={dialogLine('undo')} onClose={closeDialog} />
      <RestoreDialog line={dialogLine('restore')} onClose={closeDialog} />
    </>
  );
}
