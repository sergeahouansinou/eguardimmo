'use client';

import { BookOpen, CreditCard, FileSearch, FileText, FolderOpen, Gavel, HandCoins, Mail, Send, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Alert, Button, Checkbox, Chip, ConfirmDialog, MenuItem, MenuSeparator, Select, StatCard, Tab, TabList, TabPanel, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, Tabs, TextField } from '@eguardimmo/ui';
import { downloadCsv } from './csv';
import { formatDate } from './dates';
import { formatMoneyInput, sum } from './money';
import { EmptyBlock, FINANCES_ROUTES, PageHeader, PagedFooter, PAGE_SIZE, QueryGate, useExec, useMoney, useSelection } from './parts';
import type { ScreenProps } from './parts';
import { useFinances } from './queries';
import { financesPaths } from './paths';
import { RowMenu } from './RowMenu';
import type { FinancesData } from './schemas';
import { creanceKey } from './recouvrement/creances';
import { OpenDossierFlow } from './recouvrement/OpenDossierFlow';
import { PlanDialog } from './impayes/PlanDialog';
import { AGE_MONTH, AGE_TWO_MONTHS, ALL, allImpayeRows, defaultImpayeFilters, filterImpayes, matchesAge, remindersOfMonth } from './impayes/rows';
import type { ImpayeFilters, ImpayeRow } from './impayes/rows';

export function ImpayesPage({ Link, navigate }: ScreenProps) {
  const query = useFinances();
  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Finances', href: FINANCES_ROUTES.operations }, { label: 'Impayés' }]}
        title="Impayés"
        description="Loyers et charges non réglés, classés par ancienneté. Chaque relance envoyée est tracée."
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
  const [openFor, setOpenFor] = useState<ImpayeRow | null>(null);

  const all = allImpayeRows(data, formatDate);
  const rows = filterImpayes(all, filters);
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const chosen = rows.filter((row) => selection.selected.has(row.echeance.id));
  const old = all.filter((row) => row.jours >= AGE_MONTH);
  const reminders = remindersOfMonth(data);
  const immeubles = [...new Set(all.map((row) => row.bail.immeuble))].sort();
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
  const openDossier = (row: ImpayeRow) => {
    if (row.dossierId) navigate(financesPaths.dossier(row.dossierId));
    else setOpenFor(row);
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
          <span className="text-caption text-fg-subtle">{all.length} dossier{all.length > 1 ? 's' : ''}, {proprietaires.length} propriétaire{proprietaires.length > 1 ? 's' : ''}</span>
        </StatCard>
        <StatCard label={`Plus de ${String(AGE_MONTH)} jours`} icon={FileText} value={money(sum(old.map((row) => row.reste)))}>
          <span className="text-caption text-fg-subtle">{old.length === 0 ? 'Aucun locataire' : old.map((row) => `${row.bail.unite}, ${row.bail.locataire}`).join(' ; ')}</span>
        </StatCard>
        <StatCard label="Relances envoyées ce mois" icon={Mail} value={String(reminders.total)}>
          <span className="text-caption text-fg-subtle">{reminders.recommandes === 0 ? 'dont aucune lettre recommandée' : `dont ${String(reminders.recommandes)} lettre${reminders.recommandes > 1 ? 's' : ''} recommandée${reminders.recommandes > 1 ? 's' : ''}`}</span>
        </StatCard>
      </section>

      <section aria-label="Liste des impayés" className="flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface p-4">
        <Tabs value={filters.age} defaultValue="tous" onValueChange={(age) => { update({ age: age === 'moins30' || age === 'de30a60' || age === 'plus60' ? age : 'tous' }); }}>
          <TabList aria-label="Ancienneté du retard">
            <Tab value="tous" count={all.length}>Tous</Tab>
            <Tab value="moins30" count={count((row) => matchesAge(row.jours, 'moins30'))}>Moins de {AGE_MONTH} jours</Tab>
            <Tab value="de30a60" count={count((row) => matchesAge(row.jours, 'de30a60'))}>{AGE_MONTH} à {AGE_TWO_MONTHS} jours</Tab>
            <Tab value="plus60" count={count((row) => matchesAge(row.jours, 'plus60'))}>Plus de {AGE_TWO_MONTHS} jours</Tab>
          </TabList>
        <TabPanel value={filters.age}>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-full sm:w-56">
            <TextField label="Recherche" placeholder="Locataire, bien" value={filters.search} onChange={(event) => { update({ search: event.target.value }); }} />
          </div>
          <div className="w-full sm:w-56">
            <Select label="Immeuble" placeholder="Tous" options={[{ value: ALL, label: 'Immeuble : Tous' }, ...immeubles.map((value) => ({ value, label: value }))]} value={filters.immeuble} onValueChange={(immeuble) => { update({ immeuble }); }} />
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
        {chosen.length > 0 ? (
          <div role="region" aria-label="Sélection" className="flex flex-wrap items-center gap-2 rounded-md bg-action-subtle px-3 py-2">
            <span className="grow text-body-strong">{chosen.length} sélectionné{chosen.length > 1 ? 's' : ''}</span>
            <Button size="sm" loading={exec.pending} onClick={() => { remind(chosen, 'email', selection.clear); }}>
              Envoyer une relance
            </Button>
            {chosen.length === 1 ? (
              <Button size="sm" variant="secondary" onClick={() => { setPlanFor(chosen[0] ?? null); }}>
                Proposer un échéancier
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" onClick={() => { exportRows(chosen); }}>
              Exporter
            </Button>
          </div>
        ) : null}
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
                <TableHeaderCell>Bien</TableHeaderCell>
                <TableHeaderCell>Propriétaire</TableHeaderCell>
                <TableHeaderCell>Échéance</TableHeaderCell>
                <TableHeaderCell numeric>Reste dû</TableHeaderCell>
                <TableHeaderCell>Ancienneté</TableHeaderCell>
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
                    <TableCell strong>{row.bail.locataire}</TableCell>
                    <TableCell>{row.bail.unite}</TableCell>
                    <TableCell>{row.bail.proprietaire}</TableCell>
                    <TableCell>{formatDate(row.echeance.echeance)}</TableCell>
                    <TableCell numeric className="font-semibold text-fg-danger">{money(row.reste)}</TableCell>
                    <TableCell>{row.jours} jour{row.jours > 1 ? 's' : ''}</TableCell>
                    <TableCell>{row.derniere ? formatDate(row.derniere) : '—'}</TableCell>
                    <TableCell>{row.etape}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        <Button variant="link" size="sm" onClick={() => { openDossier(row); }}>
                          {row.dossierId ? 'Ouvrir le dossier' : 'Ouvrir un dossier'}
                        </Button>
                        <RowMenu>
                          <MenuItem icon={Send} onSelect={() => { remind([row], 'email'); }}>Relancer par e-mail</MenuItem>
                          <MenuItem icon={Mail} onSelect={() => { remind([row], 'courrier'); }}>Relancer par courrier</MenuItem>
                          <MenuItem icon={FileSearch} onSelect={() => { navigate(financesPaths.relance(id)); }}>Aperçu de la relance</MenuItem>
                          <MenuItem icon={CreditCard} onSelect={() => { navigate(`${FINANCES_ROUTES.encaisser}?echeance=${id}`); }}>Enregistrer un paiement</MenuItem>
                          <MenuItem icon={HandCoins} onSelect={() => { navigate(`${FINANCES_ROUTES.acompte}?bail=${row.bail.id}`); }}>Enregistrer un acompte</MenuItem>
                          <MenuItem icon={FileText} onSelect={() => { setPlanFor(row); }}>Proposer un échéancier</MenuItem>
                          <MenuItem icon={BookOpen} onSelect={() => { navigate(financesPaths.grandLivre(id)); }}>Grand livre du locataire</MenuItem>
                          <MenuItem icon={Gavel} onSelect={() => { navigate(financesPaths.relance(id, 'mise_en_demeure')); }}>Mise en demeure</MenuItem>
                          <MenuItem icon={FolderOpen} onSelect={() => { openDossier(row); }}>Dossier de recouvrement</MenuItem>
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
        reste={planFor?.resteAEtaler ?? 0}
        today={data.today}
        money={money}
        pending={exec.pending}
        error={exec.error}
        onClose={() => { setPlanFor(null); exec.reset(); }}
        onSubmit={(values) => { if (planFor) exec.run({ type: 'proposePlan', dossierId: null, echeanceId: planFor.echeance.id, ...values }, { onDone: () => { setPlanFor(null); } }); }}
      />
      {openFor ? (
        <OpenDossierFlow
          data={data}
          bailId={openFor.bail.id}
          initial={[creanceKey({ kind: 'echeance', refId: openFor.echeance.id })]}
          exec={exec}
          navigate={navigate}
          money={money}
          onClose={() => { setOpenFor(null); }}
        />
      ) : null}
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
