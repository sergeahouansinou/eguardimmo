'use client';

import { BookOpen, CreditCard, FileText, Mail, Send, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Alert, Button, Checkbox, Chip, ConfirmDialog, MenuItem, MenuSeparator, Select, StatCard, Tab, TabList, TabPanel, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, Tabs, TextField } from '@eguardimmo/ui';
import { downloadCsv } from './csv';
import { formatDate, monthNameOf } from './dates';
import { formatMoneyInput, sum } from './money';
import { EmptyBlock, FINANCES_ROUTES, PageHeader, PagedFooter, PAGE_SIZE, QueryGate, useExec, useMoney, useSelection } from './parts';
import type { ScreenProps } from './parts';
import { useFinances } from './queries';
import { financesPaths } from './paths';
import { RowMenu } from './RowMenu';
import type { FinancesData } from './schemas';
import { PlanDialog } from './impayes/PlanDialog';
import { ALL, OLD_THRESHOLD, VERY_OLD_THRESHOLD, allImpayeRows, defaultImpayeFilters, filterImpayes, remindersOfMonth } from './impayes/rows';
import type { ImpayeFilters, ImpayeRow } from './impayes/rows';

export function ImpayesPage({ Link, navigate }: ScreenProps) {
  const query = useFinances();
  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Finances', href: FINANCES_ROUTES.operations }, { label: 'Impayés' }]}
        title="Impayés"
        description="Loyers et charges non réglés, classés par ancienneté. Chaque relance envoyée est tracée dans le dossier."
      />
      <QueryGate query={query} errorTitle="Les impayés n’ont pas pu être chargés">
        {(data) => <ImpayesContent data={data} navigate={navigate} />}
      </QueryGate>
    </>
  );
}

function ImpayesContent({ data, navigate }: Pick<ScreenProps, 'navigate'> & { data: FinancesData }) {
  const money = useMoney(data.currency);
  const exec = useExec({ navigate });
  const selection = useSelection();
  const [filters, setFilters] = useState<ImpayeFilters>(defaultImpayeFilters);
  const [page, setPage] = useState(1);
  const [planFor, setPlanFor] = useState<ImpayeRow | null>(null);
  const [writeOff, setWriteOff] = useState<ImpayeRow | null>(null);

  const all = allImpayeRows(data, formatDate);
  const rows = filterImpayes(all, filters);
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const chosen = rows.filter((row) => selection.selected.has(row.echeance.id));
  const old = all.filter((row) => row.jours >= VERY_OLD_THRESHOLD);
  const reminders = remindersOfMonth(data);
  const proprietaires = [...new Set(all.map((row) => row.bail.proprietaire))].sort();
  const dirty = JSON.stringify(filters) !== JSON.stringify(defaultImpayeFilters);
  const allChecked = visible.length > 0 && visible.every((row) => selection.selected.has(row.echeance.id));
  const count = (predicate: (row: ImpayeRow) => boolean) => all.filter(predicate).length;

  const update = (patch: Partial<ImpayeFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };
  const remind = (targets: readonly ImpayeRow[], canal: 'email' | 'courrier', onDone?: () => void) => {
    exec.run({ type: 'sendReminders', echeanceIds: targets.map((row) => row.echeance.id), canal }, { onDone });
  };
  const exportRows = (targets: readonly ImpayeRow[]) => {
    downloadCsv('impayes.csv', [
      ['Locataire', 'Bien', 'Propriétaire', 'Échéance', 'Reste dû', 'Retard (jours)', 'Dernière relance', 'Prochaine étape'],
      ...targets.map((row) => [row.bail.locataire, `${row.bail.unite}, ${row.bail.immeuble}`, row.bail.proprietaire, formatDate(row.echeance.echeance), formatMoneyInput(row.reste), row.jours, row.derniere ? formatDate(row.derniere) : '', row.etape]),
    ]);
  };

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={() => { exportRows(chosen.length > 0 ? chosen : rows); }}>
          Exporter
        </Button>
        <Button disabled={chosen.length === 0} loading={exec.pending} onClick={() => { remind(chosen, 'email', selection.clear); }}>
          Relancer la sélection
        </Button>
      </div>
      {exec.error ? (
        <Alert tone="danger" title="L’opération n’a pas été enregistrée">
          {exec.error.message}
        </Alert>
      ) : null}
      <section aria-label="Chiffres des impayés" className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard label="Total impayé" tone="danger" icon={TriangleAlert} value={money(sum(all.map((row) => row.reste)))}>
          <span className="text-caption text-fg-subtle">{all.length} dossier{all.length > 1 ? 's' : ''}, {new Set(all.map((row) => row.bail.proprietaire)).size} propriétaire{new Set(all.map((row) => row.bail.proprietaire)).size > 1 ? 's' : ''}</span>
        </StatCard>
        <StatCard label={`Plus de ${String(VERY_OLD_THRESHOLD)} jours`} icon={FileText} value={money(sum(old.map((row) => row.reste)))}>
          <span className="text-caption text-fg-subtle">{old.length === 0 ? 'Aucun retard ancien' : old.map((row) => `${row.bail.unite}, ${row.bail.locataire}`).join(' ; ')}</span>
        </StatCard>
        <StatCard label={`Relances en ${monthNameOf(data.today)}`} icon={Mail} value={String(reminders.total)}>
          <span className="text-caption text-fg-subtle">sur {reminders.dossiers} dossier{reminders.dossiers > 1 ? 's' : ''}</span>
        </StatCard>
      </section>

      <section aria-label="Liste des impayés" className="flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface p-4">
        <Tabs value={filters.age} defaultValue="tous" onValueChange={(age) => { update({ age: age === 'recent' || age === 'ancien' ? age : 'tous' }); }}>
          <TabList aria-label="Ancienneté du retard">
            <Tab value="tous" count={all.length}>Tous</Tab>
            <Tab value="recent" count={count((row) => row.jours < OLD_THRESHOLD)}>Moins de {OLD_THRESHOLD} jours</Tab>
            <Tab value="ancien" count={count((row) => row.jours >= OLD_THRESHOLD)}>Plus de {OLD_THRESHOLD} jours</Tab>
          </TabList>
        <TabPanel value={filters.age}>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-full sm:w-56">
            <TextField label="Recherche" placeholder="Locataire, lot" value={filters.search} onChange={(event) => { update({ search: event.target.value }); }} />
          </div>
          <div className="w-full sm:w-56">
            <Select label="Propriétaire" placeholder="Tous" options={[{ value: ALL, label: 'Propriétaire : Tous' }, ...proprietaires.map((value) => ({ value, label: value }))]} value={filters.proprietaire} onValueChange={(proprietaire) => { update({ proprietaire }); }} />
          </div>
          <Chip pressed={filters.miseEnDemeure} onClick={() => { update({ miseEnDemeure: !filters.miseEnDemeure }); }}>
            Mise en demeure à envoyer
          </Chip>
          <Button variant="link" size="sm" disabled={!dirty} onClick={() => { setFilters(defaultImpayeFilters); setPage(1); }}>
            Effacer les filtres
          </Button>
        </div>
        {rows.length === 0 ? (
          <EmptyBlock title={dirty ? 'Aucun impayé ne correspond aux filtres' : 'Aucun impayé'}>
            {dirty ? 'Modifiez ou effacez les filtres pour élargir la liste.' : 'Toutes les échéances échues sont réglées.'}
          </EmptyBlock>
        ) : (
          <Table aria-label="Impayés">
            <TableHead>
              <tr>
                <TableHeaderCell className="w-8">
                  <Checkbox label="Tout sélectionner" hideLabel checked={allChecked} onChange={(event) => { selection.setAll(visible.map((row) => row.echeance.id), event.target.checked); }} />
                </TableHeaderCell>
                <TableHeaderCell>Locataire</TableHeaderCell>
                <TableHeaderCell>Propriétaire</TableHeaderCell>
                <TableHeaderCell>Échéance</TableHeaderCell>
                <TableHeaderCell numeric>Reste dû</TableHeaderCell>
                <TableHeaderCell>Retard</TableHeaderCell>
                <TableHeaderCell>Dernière relance</TableHeaderCell>
                <TableHeaderCell>Prochaine étape</TableHeaderCell>
                <TableHeaderCell>Action</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {visible.map((row) => {
                const id = row.echeance.id;
                return (
                  <TableRow key={id} selected={selection.selected.has(id)}>
                    <TableCell>
                      <Checkbox label={`Sélectionner ${row.bail.locataire}`} hideLabel checked={selection.selected.has(id)} onChange={() => { selection.toggle(id); }} />
                    </TableCell>
                    <TableCell strong>
                      {row.bail.locataire}
                      <span className="block text-caption font-normal text-fg-subtle">{row.bail.unite}</span>
                    </TableCell>
                    <TableCell>{row.bail.proprietaire}</TableCell>
                    <TableCell>{formatDate(row.echeance.echeance)}</TableCell>
                    <TableCell numeric className="font-semibold text-fg-danger">{money(row.reste)}</TableCell>
                    <TableCell>{row.jours} jour{row.jours > 1 ? 's' : ''}</TableCell>
                    <TableCell>{row.derniere ? formatDate(row.derniere) : '—'}</TableCell>
                    <TableCell>{row.etape}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        <Button variant="link" size="sm" onClick={() => { navigate(financesPaths.impaye(id)); }}>
                          Ouvrir
                        </Button>
                        <RowMenu>
                          <MenuItem icon={Send} onSelect={() => { remind([row], 'email'); }}>Relancer par e-mail</MenuItem>
                          <MenuItem icon={Mail} onSelect={() => { remind([row], 'courrier'); }}>Relancer par courrier</MenuItem>
                          <MenuItem icon={CreditCard} onSelect={() => { navigate(`${FINANCES_ROUTES.encaisser}?echeance=${id}`); }}>Enregistrer un paiement</MenuItem>
                          <MenuItem icon={FileText} onSelect={() => { setPlanFor(row); }}>Proposer un échéancier</MenuItem>
                          <MenuItem icon={BookOpen} onSelect={() => { navigate(financesPaths.grandLivre(id)); }}>Grand livre</MenuItem>
                          <MenuSeparator />
                          <MenuItem icon={TriangleAlert} tone="danger" onSelect={() => { setWriteOff(row); }}>Passer en irrécouvrable</MenuItem>
                        </RowMenu>
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <PagedFooter page={page} total={rows.length} onPageChange={setPage} label="Pagination des impayés" />
        </TabPanel>
        </Tabs>
      </section>

      <PlanDialog
        open={planFor !== null}
        reste={planFor?.reste ?? 0}
        today={data.today}
        money={money}
        pending={exec.pending}
        error={exec.error}
        onClose={() => { setPlanFor(null); exec.reset(); }}
        onSubmit={(values) => { if (planFor) exec.run({ type: 'proposePlan', echeanceId: planFor.echeance.id, ...values }, { onDone: () => { setPlanFor(null); } }); }}
      />
      <ConfirmDialog
        open={writeOff !== null}
        onOpenChange={(open) => { if (!open) setWriteOff(null); }}
        title="Passer la créance en irrécouvrable ?"
        description={writeOff ? `${writeOff.bail.locataire}, ${money(writeOff.reste)} : la créance sort de la liste des impayés mais reste consultable dans le grand livre.` : ''}
        confirmLabel="Passer en irrécouvrable"
        tone="danger"
        loading={exec.pending}
        onConfirm={() => { if (writeOff) exec.run({ type: 'markUncollectible', echeanceId: writeOff.echeance.id }, { onDone: () => { setWriteOff(null); }, onError: () => { setWriteOff(null); } }); }}
      />
    </>
  );
}
