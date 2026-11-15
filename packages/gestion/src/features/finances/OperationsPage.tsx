'use client';

import { CircleCheck, Receipt, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Select, StatCard, Tab, TabList, TabPanel, Tabs, TextField } from '@eguardimmo/ui';
import { bilanView } from './derive';
import { monthNameOf } from './dates';
import { periodKpis } from './derive';
import { DateField, FINANCES_ROUTES, PageHeader, QueryGate, useExec, useMoney } from './parts';
import type { ScreenProps } from './parts';
import { useFinances } from './queries';
import type { FinancesData } from './schemas';
import { DepensesTab } from './operations/DepensesTab';
import { EcheancesTab } from './operations/EcheancesTab';
import { EncaisseTab } from './operations/EncaisseTab';
import { ALL, defaultFilters, depenseRows, echeanceRows, filterOptions, paiementRows } from './operations/rows';
import type { OperationsFilters } from './operations/rows';

export function OperationsPage({ Link, navigate }: ScreenProps) {
  const query = useFinances();
  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Accueil', href: '/' }, { label: 'Finances' }]}
        title="Finances"
        description="Ce qui reste à encaisser passe en premier. Le reste est dans les onglets."
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href={FINANCES_ROUTES.depense}>Ajouter une dépense</Link>
            </Button>
            <Button asChild>
              <Link href={FINANCES_ROUTES.encaisser}>Enregistrer un paiement</Link>
            </Button>
          </>
        }
      />
      <QueryGate query={query} errorTitle="Les finances n’ont pas pu être chargées">
        {(data) => <OperationsContent data={data} Link={Link} navigate={navigate} />}
      </QueryGate>
    </>
  );
}

function OperationsContent({ data, Link, navigate }: ScreenProps & { data: FinancesData }) {
  const money = useMoney(data.currency);
  const exec = useExec({ navigate });
  const initial = defaultFilters(data.today);
  const [tab, setTab] = useState('a-encaisser');
  const [filters, setFilters] = useState<OperationsFilters>(initial);
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const options = filterOptions(data);
  const kpis = periodKpis(data, data.today.slice(0, 7));
  const month = monthNameOf(data.today);
  const echeances = echeanceRows(data, filters, direction);
  const paiements = paiementRows(data, filters);
  const depenses = depenseRows(data, filters);
  const filtered = JSON.stringify(filters) !== JSON.stringify(initial);
  const bilan = data.bilans.find((item) => item.annee === data.resume.declaration.annee);
  const net = bilan ? bilanView(bilan, 'foncier_reel').net : null;

  const update = (patch: Partial<OperationsFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };
  const toAll = (label: string, values: readonly string[]) => [{ value: ALL, label: `${label} : Tous` }, ...values.map((value) => ({ value, label: value }))];
  const isEcheances = tab === 'a-encaisser';

  return (
    <>
      <section aria-label="Chiffres de la période" className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard label={`Encaissé, ${month}`} icon={Wallet} value={money(kpis.encaisse)}>
          <span className="text-caption text-fg-subtle">sur {money(kpis.attendu)} attendus</span>
        </StatCard>
        <StatCard label={`Dépenses, ${month}`} icon={Receipt} value={money(kpis.depenses)}>
          <span className="text-caption text-fg-subtle">dont {money(kpis.reparations)} de réparation</span>
        </StatCard>
        <StatCard label="Résultat du mois" icon={CircleCheck} value={money(kpis.resultat)}>
          <Badge tone="success" className="self-start">Avant impôt</Badge>
        </StatCard>
      </section>

      <section aria-label="Transactions" className="flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface p-4">
        <Tabs
          value={tab}
          defaultValue="a-encaisser"
          onValueChange={(next) => {
            setTab(next);
            setPage(1);
          }}
        >
          <div className="flex items-end justify-between gap-2">
            <TabList aria-label="Type d’opération" className="grow">
              <Tab value="a-encaisser" count={echeanceRows(data, initial, 'asc').length}>À encaisser</Tab>
              <Tab value="encaisse" count={paiementRows(data, initial).length}>Encaissé</Tab>
              <Tab value="depenses" count={depenseRows(data, initial).length}>Dépenses</Tab>
            </TabList>
            <Button variant="link" size="sm" disabled={!filtered} onClick={() => { setFilters(initial); setPage(1); }}>
              Effacer les filtres
            </Button>
          </div>
          <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <DateField label="Du" value={filters.from} onChange={(from) => { update({ from }); }} />
            <DateField label="Au" value={filters.to} onChange={(to) => { update({ to }); }} />
            <TextField label="Recherche" placeholder="Locataire, bien" value={filters.search} onChange={(event) => { update({ search: event.target.value }); }} />
            {isEcheances || tab === 'encaisse' ? (
              <>
                <Select label="Propriétaire" placeholder="Tous" options={toAll('Propriétaire', options.proprietaires)} value={filters.proprietaire} onValueChange={(proprietaire) => { update({ proprietaire }); }} />
                <Select label="Bien" placeholder="Tous" searchable options={toAll('Bien', options.biens)} value={filters.bien} onValueChange={(bien) => { update({ bien }); }} />
                <Select label="Bail" placeholder="Tous" searchable options={toAll('Bail', options.baux)} value={filters.bail} onValueChange={(bail) => { update({ bail }); }} />
              </>
            ) : (
              <Select label="Bien" placeholder="Tous" searchable options={toAll('Bien', options.biens)} value={filters.bien} onValueChange={(bien) => { update({ bien }); }} />
            )}
            {isEcheances ? (
              <Select
                label="État"
                placeholder="Tous"
                options={[
                  { value: ALL, label: 'État : Tous' },
                  { value: 'retard', label: 'En retard' },
                  { value: 'partiel', label: 'Partiel' },
                  { value: 'trop_percu', label: 'Trop perçu' },
                  { value: 'a_venir', label: 'À venir' },
                ]}
                value={filters.etat}
                onValueChange={(etat) => { update({ etat }); }}
              />
            ) : null}
          </div>
          <TabPanel value="a-encaisser">
            <EcheancesTab data={data} rows={echeances} direction={direction} onDirection={() => { setDirection((current) => (current === 'asc' ? 'desc' : 'asc')); }} page={page} onPage={setPage} money={money} exec={exec} navigate={navigate} filtered={filtered} />
          </TabPanel>
          <TabPanel value="encaisse">
            <EncaisseTab Link={Link} rows={paiements} page={page} onPage={setPage} money={money} filtered={filtered} />
          </TabPanel>
          <TabPanel value="depenses">
            <DepensesTab navigate={navigate} rows={depenses} page={page} onPage={setPage} money={money} exec={exec} filtered={filtered} />
          </TabPanel>
        </Tabs>
      </section>

      <details className="rounded-lg border border-line bg-surface">
        <summary className="cursor-pointer px-3 py-2 text-block-title text-fg">Bilan, prévisionnel et déclaration annuelle</summary>
        <ul className="flex flex-col px-3 pb-2 text-body text-fg-muted">
          <li className="flex items-center justify-between gap-2 border-t border-line py-2">
            <Link href={FINANCES_ROUTES.bilan} className="underline underline-offset-3">Bilan {String(data.resume.declaration.annee)}, résultat net</Link>
            <b className="text-fg">{net === null ? '—' : money(net)}</b>
          </li>
          <li className="flex items-center justify-between gap-2 border-t border-line py-2">
            <Link href="/analytique/previsionnel" className="underline underline-offset-3">Prévisionnel, 12 mois, loyers constants</Link>
            <b className="text-fg">{money(data.resume.previsionnel12Mois, true)}</b>
          </li>
          <li className="flex items-center justify-between gap-2 border-t border-line py-2">
            <Link href={FINANCES_ROUTES.bilan} className="underline underline-offset-3">Déclaration annuelle {String(data.resume.declaration.annee)}</Link>
            <Badge tone={data.resume.declaration.statut === 'validee' ? 'success' : 'warning'}>{data.resume.declaration.statut === 'validee' ? 'Validée' : 'Brouillon à valider'}</Badge>
          </li>
        </ul>
      </details>
    </>
  );
}

