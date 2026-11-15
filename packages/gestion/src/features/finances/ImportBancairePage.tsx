'use client';

import { Archive, CircleCheck, Scissors, Search, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Alert, Button, Chip, MenuItem, MenuSeparator, Select, Tab, TabList, TabPanel, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, Tabs, TextField } from '@eguardimmo/ui';
import { formatDate } from './dates';
import { bailOf, isOpen, resteDu } from './derive';
import { EmptyBlock, FINANCES_ROUTES, PageHeader, PagedFooter, PAGE_SIZE, QueryGate, useExec, useMoney } from './parts';
import type { ScreenProps } from './parts';
import { useFinances } from './queries';
import { RowMenu } from './RowMenu';
import type { FinancesData, LigneBancaire } from './schemas';
import { AutomationsDialog, ChooseEntryDialog, ImportBankDialog, SplitDialog } from './banque/BankDialogs';
import { formatMoneyInput } from './money';

type BankTab = LigneBancaire['statut'];
const ALL = 'tous';
const isTab = (value: string): value is BankTab => value === 'a_rapprocher' || value === 'rapprochee' || value === 'archivee';
const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

type ActiveDialog = { kind: 'import' } | { kind: 'automations' } | { kind: 'choose'; ligne: LigneBancaire } | { kind: 'split'; ligne: LigneBancaire } | null;

export function ImportBancairePage({ Link, navigate }: ScreenProps) {
  const query = useFinances();
  return (
    <QueryGate query={query} errorTitle="Les opérations bancaires n’ont pas pu être chargées">
      {(data) => <ImportContent data={data} Link={Link} navigate={navigate} />}
    </QueryGate>
  );
}

function ImportContent({ data, Link, navigate }: ScreenProps & { data: FinancesData }) {
  const money = useMoney(data.currency);
  const exec = useExec({ navigate });
  const [tab, setTab] = useState<BankTab>('a_rapprocher');
  const [search, setSearch] = useState('');
  const [compte, setCompte] = useState(ALL);
  const [sens, setSens] = useState<'revenus' | 'depenses' | null>(null);
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<ActiveDialog>(null);

  const comptes = [...new Set(data.lignesBancaires.map((ligne) => ligne.compte))].sort();
  const needle = fold(search.trim());
  const rows = data.lignesBancaires
    .filter(
      (ligne) =>
        ligne.statut === tab &&
        (compte === ALL || ligne.compte === compte) &&
        (sens === null || (sens === 'revenus' ? ligne.montant > 0 : ligne.montant < 0)) &&
        (needle === '' || fold(`${ligne.libelle} ${formatMoneyInput(ligne.montant)}`).includes(needle)),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const dirty = search !== '' || compte !== ALL || sens !== null;
  const countOf = (statut: BankTab) => data.lignesBancaires.filter((ligne) => ligne.statut === statut).length;
  const close = () => { setDialog(null); exec.reset(); };
  const done = () => { setDialog(null); };

  const validProposal = (ligne: LigneBancaire) => {
    const echeance = data.echeances.find((item) => item.id === ligne.echeanceProposeeId);
    return echeance !== undefined && ligne.montant > 0 && isOpen(echeance) && resteDu(echeance) > 0 ? echeance : null;
  };
  const entries = data.echeances
    .filter((echeance) => isOpen(echeance) && resteDu(echeance) > 0)
    .sort((a, b) => a.echeance.localeCompare(b.echeance))
    .map((echeance) => {
      const bail = bailOf(data, echeance.bailId);
      return { value: echeance.id, label: `${bail?.locataire ?? ''}, ${echeance.libelle}`, description: `${bail?.unite ?? ''} · reste ${money(resteDu(echeance))}` };
    });
  const match = (ligne: LigneBancaire, echeanceId: string) => { exec.run({ type: 'matchBankLine', ligneId: ligne.id, echeanceId }, { onDone: done }); };
  const classify = (ligne: LigneBancaire) => { navigate(`${FINANCES_ROUTES.depense}?banque=${ligne.id}`); };
  const primary = (ligne: LigneBancaire) => {
    if (ligne.statut === 'archivee') return { label: 'Restaurer', run: () => { exec.run({ type: 'restoreBankLine', ligneId: ligne.id }); } };
    if (ligne.montant < 0) return { label: 'Classer', run: () => { classify(ligne); } };
    const proposal = validProposal(ligne);
    if (proposal) return { label: 'Valider', run: () => { match(ligne, proposal.id); } };
    return { label: 'Ouvrir', run: () => { setDialog({ kind: 'choose', ligne }); } };
  };

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Finances', href: FINANCES_ROUTES.operations }, { label: 'Import bancaire' }]}
        title="Transactions bancaires"
        description="Les opérations importées sont proposées en correspondance avec les loyers. Rien n’est enregistré sans votre validation."
        actions={
          <>
            <Button variant="secondary" onClick={() => { setDialog({ kind: 'automations' }); }}>
              Automatisations
            </Button>
            <Button onClick={() => { setDialog({ kind: 'import' }); }}>Nouvel import</Button>
          </>
        }
      />
      {exec.error && dialog === null ? (
        <Alert tone="danger" title="L’opération n’a pas été enregistrée">
          {exec.error.message}
        </Alert>
      ) : null}
      <section aria-label="Opérations bancaires" className="flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface p-4">
        <Tabs value={tab} defaultValue="a_rapprocher" onValueChange={(next) => { if (isTab(next)) { setTab(next); setPage(1); } }}>
          <TabList aria-label="Statut de l’opération">
            <Tab value="a_rapprocher" count={countOf('a_rapprocher')}>À rapprocher</Tab>
            <Tab value="rapprochee" count={countOf('rapprochee')}>Rapprochées</Tab>
            <Tab value="archivee" count={countOf('archivee')}>Archives</Tab>
          </TabList>
        <TabPanel value={tab}>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-full sm:w-56">
            <TextField label="Recherche" placeholder="Libellé, montant" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          </div>
          <div className="w-full sm:w-52">
            <Select label="Compte" placeholder="Tous" options={[{ value: ALL, label: 'Compte : Tous' }, ...comptes.map((value) => ({ value, label: value }))]} value={compte} onValueChange={(value) => { setCompte(value); setPage(1); }} />
          </div>
          <Chip pressed={sens === 'revenus'} onClick={() => { setSens(sens === 'revenus' ? null : 'revenus'); setPage(1); }}>Revenus</Chip>
          <Chip pressed={sens === 'depenses'} onClick={() => { setSens(sens === 'depenses' ? null : 'depenses'); setPage(1); }}>Dépenses</Chip>
          <Button variant="link" size="sm" disabled={!dirty} onClick={() => { setSearch(''); setCompte(ALL); setSens(null); setPage(1); }}>
            Effacer les filtres
          </Button>
        </div>
        {rows.length === 0 ? (
          <EmptyBlock title={dirty ? 'Aucune opération ne correspond aux filtres' : tab === 'a_rapprocher' ? 'Rien à rapprocher' : 'Aucune opération'}>
            {tab === 'a_rapprocher' && !dirty ? 'Importez un relevé pour proposer des correspondances.' : 'Modifiez ou effacez les filtres.'}
          </EmptyBlock>
        ) : (
          <Table aria-label="Opérations bancaires">
            <TableHead>
              <tr>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>Libellé</TableHeaderCell>
                <TableHeaderCell>Compte</TableHeaderCell>
                <TableHeaderCell numeric>Montant</TableHeaderCell>
                <TableHeaderCell>Correspondance proposée</TableHeaderCell>
                <TableHeaderCell>Action</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {visible.map((ligne) => {
                const action = primary(ligne);
                const proposal = validProposal(ligne);
                return (
                  <TableRow key={ligne.id}>
                    <TableCell>{formatDate(ligne.date)}</TableCell>
                    <TableCell strong>{ligne.libelle}</TableCell>
                    <TableCell>{ligne.compte}</TableCell>
                    <TableCell numeric className={ligne.montant > 0 ? 'font-semibold' : undefined}>{money(ligne.montant, true)}</TableCell>
                    <TableCell>{ligne.statut === 'rapprochee' ? 'Rapprochée avec l’échéance' : ligne.indication}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        <Button variant="link" size="sm" onClick={action.run}>
                          {action.label}
                        </Button>
                        {ligne.statut === 'a_rapprocher' ? (
                          <RowMenu>
                            <MenuItem icon={CircleCheck} disabled={!proposal} onSelect={() => { if (proposal) match(ligne, proposal.id); }}>Valider la correspondance</MenuItem>
                            <MenuItem icon={Search} disabled={ligne.montant < 0} onSelect={() => { setDialog({ kind: 'choose', ligne }); }}>Choisir une autre écriture</MenuItem>
                            <MenuItem icon={Wallet} disabled={ligne.montant > 0} onSelect={() => { classify(ligne); }}>Créer une dépense</MenuItem>
                            <MenuItem icon={Scissors} onSelect={() => { setDialog({ kind: 'split', ligne }); }}>Diviser l’opération</MenuItem>
                            <MenuSeparator />
                            <MenuItem icon={Archive} onSelect={() => { exec.run({ type: 'ignoreBankLine', ligneId: ligne.id }); }}>Ignorer</MenuItem>
                          </RowMenu>
                        ) : null}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <PagedFooter page={page} total={rows.length} onPageChange={setPage} label="Pagination des opérations" />
        </TabPanel>
        </Tabs>
      </section>

      {dialog?.kind === 'import' ? (
        <ImportBankDialog
          open
          comptes={comptes.length > 0 ? comptes : [data.workspace.compte]}
          pending={exec.pending}
          error={exec.error}
          onClose={close}
          onSubmit={(values) => { exec.run({ type: 'importBankLines', ...values }, { onDone: () => { done(); setTab('a_rapprocher'); setPage(1); } }); }}
        />
      ) : null}
      {dialog?.kind === 'choose' ? (
        <ChooseEntryDialog open ligne={dialog.ligne} entries={entries} pending={exec.pending} error={exec.error} onClose={close} onSubmit={(echeanceId) => { match(dialog.ligne, echeanceId); }} />
      ) : null}
      {dialog?.kind === 'split' ? (
        <SplitDialog open ligne={dialog.ligne} money={money} pending={exec.pending} error={exec.error} onClose={close} onSubmit={(premierePart) => { exec.run({ type: 'splitBankLine', ligneId: dialog.ligne.id, premierePart }, { onDone: done }); }} />
      ) : null}
      {dialog?.kind === 'automations' ? (
        <AutomationsDialog open automatisations={data.automatisations} pending={exec.pending} error={exec.error} onClose={close} onToggle={(automatisationId, active) => { exec.run({ type: 'toggleAutomation', automatisationId, active }); }} />
      ) : null}
    </>
  );
}
