'use client';

import { Archive, ArchiveArrowUp, Download, HandCoins, Pencil, Trash } from 'lucide-react';
import { useState } from 'react';
import { Alert, Button, ConfirmDialog, MenuItem, MenuSeparator, ProgressBar, Select, StatCard, Tab, TabList, TabPanel, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, Tabs, TextField } from '@eguardimmo/ui';
import { downloadCsv } from './csv';
import { formatDate, formatMonthYear } from './dates';
import { estimateSchedule, pretAvancement, tauxLabel } from './derive';
import { formatMoneyInput, sum } from './money';
import { EmptyBlock, FINANCES_ROUTES, PageHeader, PagedFooter, PAGE_SIZE, QueryGate, useExec, useMoney } from './parts';
import type { ScreenProps } from './parts';
import { useFinances } from './queries';
import { RowMenu } from './RowMenu';
import type { FinancesData, Pret } from './schemas';
import { ImportDialog } from './prets/ImportDialog';
import { PrepayDialog } from './prets/PrepayDialog';
import { PretDialog } from './prets/PretDialog';
import { ScheduleDialog } from './prets/ScheduleDialog';
import type { ScheduleLine } from './prets/schedule';

type PretTab = 'en_cours' | 'rembourse' | 'archive';
const ALL = 'tous';
const isTab = (value: string): value is PretTab => value === 'en_cours' || value === 'rembourse' || value === 'archive';
const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function PretsPage({ Link, navigate }: ScreenProps) {
  const query = useFinances();
  return (
    <QueryGate query={query} errorTitle="Les prêts n’ont pas pu être chargés">
      {(data) => <PretsContent data={data} Link={Link} navigate={navigate} />}
    </QueryGate>
  );
}

type ActiveDialog = { kind: 'form'; pret: Pret | null } | { kind: 'import' } | { kind: 'prepay'; pret: Pret } | { kind: 'schedule'; pret: Pret } | null;

function scheduleOf(pret: Pret, today: string): { lignes: readonly ScheduleLine[]; estimated: boolean } {
  return pret.echeancier ? { lignes: pret.echeancier, estimated: false } : { lignes: estimateSchedule(pret, today), estimated: true };
}

function PretsContent({ data, Link, navigate }: ScreenProps & { data: FinancesData }) {
  const money = useMoney(data.currency);
  const exec = useExec({ navigate });
  const [tab, setTab] = useState<PretTab>('en_cours');
  const [search, setSearch] = useState('');
  const [bien, setBien] = useState(ALL);
  const [banque, setBanque] = useState(ALL);
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<ActiveDialog>(null);
  const [deleting, setDeleting] = useState<Pret | null>(null);

  const all = data.prets.filter((pret) => !pret.supprime);
  const live = all.filter((pret) => pret.statut === 'en_cours');
  const biens = [...new Set(all.map((pret) => pret.bien))].sort();
  const banques = [...new Set(all.map((pret) => pret.banque))].sort();
  const dirty = search !== '' || bien !== ALL || banque !== ALL;
  const rows = all.filter(
    (pret) =>
      pret.statut === tab &&
      (bien === ALL || pret.bien === bien) &&
      (banque === ALL || pret.banque === banque) &&
      (search.trim() === '' || fold(`${pret.bien} ${pret.banque}`).includes(fold(search.trim()))),
  );
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const close = () => { setDialog(null); exec.reset(); };
  const done = () => { setDialog(null); };
  const biensOfBaux = [...new Set(data.baux.map((bail) => bail.immeuble))].sort();
  const formBiens = [...new Set([...biensOfBaux, ...biens])].sort();

  const exportSchedule = (pret: Pret) => {
    const { lignes } = scheduleOf(pret, data.today);
    downloadCsv(`echeancier-${pret.banque}.csv`, [
      ['Date', 'Mensualité', 'Intérêts', 'Capital', 'Restant dû'],
      ...lignes.map((ligne) => [formatDate(ligne.date), formatMoneyInput(ligne.mensualite), formatMoneyInput(ligne.interets), formatMoneyInput(ligne.capital), formatMoneyInput(ligne.restant)]),
    ]);
  };
  const choose = (next: PretTab) => { setTab(next); setPage(1); };

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Finances', href: FINANCES_ROUTES.operations }, { label: 'Prêts immobiliers' }]}
        title="Prêts immobiliers"
        description="Échéanciers des emprunts par bien. Les intérêts payés alimentent le bilan et la déclaration annuelle."
        actions={
          <>
            <Button variant="secondary" disabled={live.length === 0} onClick={() => { setDialog({ kind: 'import' }); }}>
              Importer un échéancier
            </Button>
            <Button onClick={() => { setDialog({ kind: 'form', pret: null }); }}>Nouveau prêt</Button>
          </>
        }
      />
      {exec.error && dialog === null ? (
        <Alert tone="danger" title="L’opération n’a pas été enregistrée">
          {exec.error.message}
        </Alert>
      ) : null}
      <section aria-label="Synthèse des prêts" className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard label="Capital restant dû" icon={HandCoins} value={money(sum(live.map((pret) => pret.restantDu)))}>
          <span className="text-caption text-fg-subtle">sur {money(sum(live.map((pret) => pret.emprunte)))} empruntés</span>
        </StatCard>
        <StatCard label="Mensualités" value={`${money(sum(live.map((pret) => pret.mensualite)))} par mois`}>
          <span className="text-caption text-fg-subtle">assurance emprunteur comprise</span>
        </StatCard>
        <StatCard label={`Intérêts payés en ${data.today.slice(0, 4)}`} value={money(sum(live.map((pret) => pret.interetsAnnee)))}>
          <span className="text-caption text-fg-subtle">déductibles des revenus fonciers</span>
        </StatCard>
      </section>

      <section aria-label="Liste des prêts" className="flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface p-4">
        <Tabs value={tab} defaultValue="en_cours" onValueChange={(next) => { if (isTab(next)) choose(next); }}>
          <TabList aria-label="Statut du prêt">
            <Tab value="en_cours" count={live.length}>En cours</Tab>
            <Tab value="rembourse" count={all.filter((pret) => pret.statut === 'rembourse').length}>Remboursés</Tab>
            <Tab value="archive" count={all.filter((pret) => pret.statut === 'archive').length}>Archivés</Tab>
          </TabList>
        <TabPanel value={tab}>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-full sm:w-56">
            <TextField label="Recherche" placeholder="Bien, banque" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          </div>
          <div className="w-full sm:w-52">
            <Select label="Bien" placeholder="Tous" options={[{ value: ALL, label: 'Bien : Tous' }, ...biens.map((value) => ({ value, label: value }))]} value={bien} onValueChange={(value) => { setBien(value); setPage(1); }} />
          </div>
          <div className="w-full sm:w-52">
            <Select label="Banque" placeholder="Toutes" options={[{ value: ALL, label: 'Banque : Toutes' }, ...banques.map((value) => ({ value, label: value }))]} value={banque} onValueChange={(value) => { setBanque(value); setPage(1); }} />
          </div>
          <Button variant="link" size="sm" disabled={!dirty} onClick={() => { setSearch(''); setBien(ALL); setBanque(ALL); setPage(1); }}>
            Effacer les filtres
          </Button>
        </div>
        {rows.length === 0 ? (
          <EmptyBlock title={dirty ? 'Aucun prêt ne correspond aux filtres' : 'Aucun prêt dans cet onglet'}>
            {dirty ? 'Modifiez ou effacez les filtres.' : 'Ajoutez un prêt pour suivre son échéancier et ses intérêts.'}
          </EmptyBlock>
        ) : (
          <Table aria-label="Prêts immobiliers">
            <TableHead>
              <tr>
                <TableHeaderCell>Bien</TableHeaderCell>
                <TableHeaderCell>Banque</TableHeaderCell>
                <TableHeaderCell numeric>Emprunté</TableHeaderCell>
                <TableHeaderCell numeric>Taux</TableHeaderCell>
                <TableHeaderCell>Fin</TableHeaderCell>
                <TableHeaderCell numeric>Mensualité</TableHeaderCell>
                <TableHeaderCell numeric>Remboursé</TableHeaderCell>
                <TableHeaderCell numeric>Restant dû</TableHeaderCell>
                <TableHeaderCell>Avancement</TableHeaderCell>
                <TableHeaderCell>Action</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {visible.map((pret) => {
                const avancement = pretAvancement(pret);
                return (
                  <TableRow key={pret.id}>
                    <TableCell strong>{pret.bien}</TableCell>
                    <TableCell>{pret.banque}</TableCell>
                    <TableCell numeric>{money(pret.emprunte)}</TableCell>
                    <TableCell numeric>{tauxLabel(pret.tauxBp)}</TableCell>
                    <TableCell>{formatMonthYear(pret.fin)}</TableCell>
                    <TableCell numeric>{money(pret.mensualite)}</TableCell>
                    <TableCell numeric>{money(pret.emprunte - pret.restantDu)}</TableCell>
                    <TableCell numeric>{money(pret.restantDu)}</TableCell>
                    <TableCell>
                      <span className="flex min-w-24 flex-col gap-0.5">
                        <ProgressBar value={avancement} label={`Avancement ${pret.bien} : ${String(avancement)} %`} />
                        <span className="text-caption text-fg-subtle">{avancement} %</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        <Button variant="link" size="sm" onClick={() => { setDialog({ kind: 'schedule', pret }); }}>
                          Échéancier
                        </Button>
                        <RowMenu>
                          <MenuItem icon={Pencil} onSelect={() => { setDialog({ kind: 'form', pret }); }}>Modifier</MenuItem>
                          <MenuItem icon={HandCoins} disabled={pret.statut !== 'en_cours'} onSelect={() => { setDialog({ kind: 'prepay', pret }); }}>Remboursement anticipé</MenuItem>
                          <MenuItem icon={Download} onSelect={() => { exportSchedule(pret); }}>Exporter l’échéancier</MenuItem>
                          {pret.statut === 'archive' ? (
                            <MenuItem icon={ArchiveArrowUp} disabled={pret.restantDu === 0} onSelect={() => { exec.run({ type: 'setPretStatut', pretId: pret.id, statut: 'en_cours' }); }}>Remettre en cours</MenuItem>
                          ) : (
                            <MenuItem icon={Archive} onSelect={() => { exec.run({ type: 'setPretStatut', pretId: pret.id, statut: 'archive' }); }}>Archiver</MenuItem>
                          )}
                          <MenuSeparator />
                          <MenuItem icon={Trash} tone="danger" onSelect={() => { setDeleting(pret); }}>Supprimer</MenuItem>
                        </RowMenu>
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <PagedFooter page={page} total={rows.length} onPageChange={setPage} label="Pagination des prêts" />
        </TabPanel>
        </Tabs>
      </section>

      {dialog?.kind === 'form' ? (
        <PretDialog
          pret={dialog.pret}
          open
          biens={formBiens}
          pending={exec.pending}
          error={exec.error}
          onClose={close}
          onSubmit={({ taux, ...values }) => { exec.run({ type: 'savePret', pretId: dialog.pret?.id ?? null, ...values, tauxBp: taux }, { onDone: done }); }}
        />
      ) : null}
      {dialog?.kind === 'prepay' ? (
        <PrepayDialog
          open
          label={`${dialog.pret.bien}, ${dialog.pret.banque}`}
          restant={dialog.pret.restantDu}
          money={money}
          pending={exec.pending}
          error={exec.error}
          onClose={close}
          onSubmit={(montant) => { exec.run({ type: 'prepayPret', pretId: dialog.pret.id, montant }, { onDone: done }); }}
        />
      ) : null}
      {dialog?.kind === 'import' ? (
        <ImportDialog
          open
          prets={live}
          initialId={live[0]?.id ?? ''}
          pending={exec.pending}
          error={exec.error}
          onClose={close}
          onSubmit={(values) => { exec.run({ type: 'importEcheancier', ...values }, { onDone: done }); }}
        />
      ) : null}
      {dialog?.kind === 'schedule' ? (
        <ScheduleDialog
          open
          title={`Échéancier, ${dialog.pret.bien}`}
          lignes={scheduleOf(dialog.pret, data.today).lignes}
          estimated={scheduleOf(dialog.pret, data.today).estimated}
          money={money}
          onExport={() => { exportSchedule(dialog.pret); }}
          onClose={close}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title="Supprimer ce prêt ?"
        description={deleting ? `${deleting.bien}, ${deleting.banque} disparaît de la liste. Les intérêts déjà déclarés restent dans les bilans passés.` : ''}
        confirmLabel="Supprimer le prêt"
        tone="danger"
        loading={exec.pending}
        onConfirm={() => { if (deleting) exec.run({ type: 'deletePret', pretId: deleting.id }, { onDone: () => { setDeleting(null); }, onError: () => { setDeleting(null); } }); }}
      />
    </>
  );
}
