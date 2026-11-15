'use client';

import { Banknote, Receipt, Scale } from 'lucide-react';
import { useState } from 'react';
import { Alert, Badge, Button, Card, CardTitle, Select, SegmentedControl, StatCard, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { downloadCsv } from './csv';
import { bilanView, REGIMES } from './derive';
import type { Regime } from './derive';
import { formatMoneyInput } from './money';
import { EmptyBlock, FINANCES_ROUTES, PageHeader, QueryGate, useMoney } from './parts';
import type { ScreenProps } from './parts';
import { useFinances } from './queries';
import type { FinancesData } from './schemas';

const isRegime = (value: string): value is Regime => REGIMES.some((regime) => regime.value === value);

export function BilanPage({ Link }: ScreenProps) {
  const query = useFinances();
  return (
    <QueryGate query={query} errorTitle="Le bilan n’a pas pu être chargé">
      {(data) => <BilanContent data={data} Link={Link} />}
    </QueryGate>
  );
}

function BilanContent({ data, Link }: Pick<ScreenProps, 'Link'> & { data: FinancesData }) {
  const money = useMoney(data.currency);
  const years = [...data.bilans.map((bilan) => bilan.annee)].sort((a, b) => b - a);
  const [year, setYear] = useState(String(data.resume.declaration.annee));
  const [regime, setRegime] = useState<Regime>('foncier_reel');
  const bilan = data.bilans.find((item) => String(item.annee) === year);
  const view = bilan ? bilanView(bilan, regime) : null;
  const regimeLabel = REGIMES.find((item) => item.value === regime)?.label ?? '';

  const exportBilan = () => {
    if (!view || !bilan) return;
    downloadCsv(`bilan-${String(bilan.annee)}-${regime}.csv`, [
      ['Catégorie', 'Détail', 'Sens', 'Montant', 'Justificatifs'],
      ...view.lignes.map((ligne) => [ligne.categorie, ligne.detail, ligne.sens === 'recette' ? 'Recette' : 'Charge', formatMoneyInput(ligne.montant), ligne.justificatifs === 'complet' ? 'Complet' : `${String(ligne.manquants)} manquant(s)`]),
      ['Résultat net', regimeLabel, '', formatMoneyInput(view.net), ''],
    ]);
  };

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Finances', href: FINANCES_ROUTES.operations }, { label: 'Bilan' }]}
        title={`Bilan ${year}`}
        description="Recettes et charges de l’année fiscale, par régime. Les montants sont calculés à partir des encaissements."
        actions={
          <>
            <div className="w-32">
              <Select label="Année" hideLabel placeholder="Année" options={years.map((value) => ({ value: String(value), label: String(value) }))} value={year} onValueChange={setYear} />
            </div>
            <Button disabled={!view} onClick={exportBilan}>
              Exporter
            </Button>
          </>
        }
      />
      {!bilan || !view ? (
        <EmptyBlock title="Aucun bilan pour cette année">Le bilan se construit au fil des encaissements et des dépenses.</EmptyBlock>
      ) : (
        <>
          <SegmentedControl label="Régime fiscal" options={REGIMES} value={regime} onValueChange={(value) => { if (isRegime(value)) setRegime(value); }} />
          <section aria-label="Résultat de l’année" className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <StatCard label={`Recettes ${year}`} icon={Banknote} value={money(view.recettes)}>
              <span className="text-caption text-fg-subtle">loyers hors charges</span>
            </StatCard>
            <StatCard label={`Charges ${year}`} icon={Receipt} value={money(view.charges)}>
              <span className="text-caption text-fg-subtle">{regime === 'micro_foncier' || regime === 'micro_bic' ? 'abattement forfaitaire' : 'travaux, taxes, assurance'}</span>
            </StatCard>
            <StatCard label="Résultat net" icon={Scale} value={money(view.net)}>
              <span className="text-caption text-fg-subtle">avant impôt</span>
            </StatCard>
          </section>
          <Card>
            <CardTitle as="h2">Détail, {regimeLabel}</CardTitle>
            <Table aria-label={`Recettes et charges ${year}`}>
              <TableHead>
                <tr>
                  <TableHeaderCell>Catégorie</TableHeaderCell>
                  <TableHeaderCell>Détail</TableHeaderCell>
                  <TableHeaderCell numeric>Montant</TableHeaderCell>
                  <TableHeaderCell>Justificatifs</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {view.lignes.map((ligne) => (
                  <TableRow key={ligne.id}>
                    <TableCell strong>{ligne.categorie}</TableCell>
                    <TableCell>{ligne.detail}</TableCell>
                    <TableCell numeric>{ligne.sens === 'charge' ? `−${money(ligne.montant)}` : money(ligne.montant)}</TableCell>
                    <TableCell>
                      {ligne.justificatifs === 'complet' ? <Badge tone="success">Complet</Badge> : <Badge tone="warning">{ligne.manquants} facture{ligne.manquants > 1 ? 's' : ''} manquante{ligne.manquants > 1 ? 's' : ''}</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <Alert tone="info" title="Simulation du régime, avant de choisir">
            Le régime se choisit avant la déclaration. Ce bilan ne tient compte ni des déficits reportables ni de la fiscalité locale ; à valider avec un professionnel.
          </Alert>
        </>
      )}
    </>
  );
}
