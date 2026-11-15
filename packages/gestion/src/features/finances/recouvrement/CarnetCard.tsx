'use client';

import type { ReactNode } from 'react';
import { Badge, Button, Card, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import type { LinkComponent } from '@eguardimmo/ui';
import { downloadCsv } from '../csv';
import { formatDate } from '../dates';
import type { DossierTotals } from '../derive';
import { formatMoneyInput } from '../money';
import { EmptyBlock } from '../parts';
import { financesPaths } from '../paths';
import type { Dossier, FinancesData } from '../schemas';

export function CarnetCard({ data, dossier, totals, money, Link }: { data: FinancesData; dossier: Dossier; totals: DossierTotals; money: (minor: number) => string; Link: LinkComponent }) {
  const factureOf = (id: string | null) => data.factures.find((facture) => facture.id === id);
  const exportCarnet = () => {
    downloadCsv(`carnet-${dossier.numero}.csv`, [
      ['N°', 'Date', 'Acte', 'Intervenant', 'Coût', 'Facture'],
      ...dossier.actes.map((acte, index) => [index + 1, formatDate(acte.date), acte.libelle, acte.intervenant, formatMoneyInput(acte.cout), factureOf(acte.factureId)?.numero ?? '']),
    ]);
  };
  return (
    <Card aria-labelledby="re-carnet">
      <CardHeader>
        <CardTitle as="h2" id="re-carnet">Carnet du commissaire de justice</CardTitle>
        <Button variant="link" size="sm" onClick={exportCarnet}>
          Exporter le carnet
        </Button>
      </CardHeader>
      {dossier.actes.length === 0 ? (
        <EmptyBlock title="Aucun acte au carnet">Ajoutez une diligence pour tracer la première relance.</EmptyBlock>
      ) : (
        <Table aria-label="Carnet des actes">
          <TableHead>
            <tr>
              <TableHeaderCell>N°</TableHeaderCell>
              <TableHeaderCell>Date</TableHeaderCell>
              <TableHeaderCell>Acte</TableHeaderCell>
              <TableHeaderCell>Intervenant</TableHeaderCell>
              <TableHeaderCell numeric>Coût</TableHeaderCell>
              <TableHeaderCell>Refacturé</TableHeaderCell>
              <TableHeaderCell>Action</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {dossier.actes.map((acte, index) => {
              const facture = factureOf(acte.factureId);
              let billed: ReactNode = <span className="text-caption text-fg-subtle">Sans frais</span>;
              if (facture) billed = <Badge tone={facture.statut === 'payee' ? 'success' : 'warning'}>{facture.numero} {facture.statut === 'payee' ? 'Payée' : 'En attente'}</Badge>;
              else if (acte.cout > 0) billed = <Badge tone="neutral">À refacturer</Badge>;
              return (
                <TableRow key={acte.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{formatDate(acte.date)}</TableCell>
                  <TableCell strong>{acte.libelle}</TableCell>
                  <TableCell>{acte.intervenant}</TableCell>
                  <TableCell numeric>{money(acte.cout)}</TableCell>
                  <TableCell>{billed}</TableCell>
                  <TableCell>
                    {facture ? (
                      <Button variant="link" size="sm" asChild>
                        <Link href={financesPaths.facture(facture.id)}>Ouvrir</Link>
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <p className="flex flex-wrap items-center justify-between gap-2 text-caption text-fg-subtle">
        <span>{dossier.actes.length} acte{dossier.actes.length > 1 ? 's' : ''} · frais engagés {money(totals.frais)}</span>
        <span>Les frais sont refacturés au locataire par une facture adressée.</span>
      </p>
    </Card>
  );
}
