'use client';

import { Alert, Button, Card, EmptyState, Icon, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { Building2, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { formatMoney } from '../../format/money';
import { LinkButton, PageHeader } from '../locataires/kit';
import { formatDateFr } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { QueryState } from '../orgapi/QueryState';
import { useOrgPermission, useOrgPropertyChoices } from '../orgapi/hooks';
import { AcquisitionFormDialog } from './AcquisitionFormDialog';
import { InvestmentsGate } from './InvestmentsGate';
import { useAcquisitions, useInvestmentsCurrency, useInvestmentsRetry } from './hooks';
import type { Acquisition } from './model';
import { investmentsPaths } from './paths';

const ALL = 'all';

export function AcquisitionsPage() {
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances', href: '/finances' }, { label: 'Coût de revient' }]}
        title="Coût de revient des biens"
        subtitle="Prix d’achat, frais d’acquisition et travaux initiaux : la base du calcul de rentabilité."
        actions={<LinkButton href={investmentsPaths.loans}>Prêts immobiliers</LinkButton>}
      />
      <InvestmentsGate>
        <AcquisitionsBody />
      </InvestmentsGate>
    </>
  );
}

function AcquisitionsBody() {
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ editing: Acquisition | null } | null>(null);
  const retry = useInvestmentsRetry();
  const acquisitions = useAcquisitions(propertyId);
  const properties = useOrgPropertyChoices();
  const currency = useInvestmentsCurrency();
  const permission = useOrgPermission('investments');
  const names = new Map((properties.data ?? []).map((property) => [property.id, property.name]));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Select
          label="Bien"
          placeholder="Tous les biens"
          value={propertyId ?? ALL}
          onValueChange={(value) => { setPropertyId(value === ALL ? null : value); }}
          options={[{ value: ALL, label: 'Tous les biens' }, ...(properties.data ?? []).map((property) => ({ value: property.id, label: property.name }))]}
        />
        {permission.write ? (
          <Button onClick={() => { setDialog({ editing: null }); }}>
            <Icon icon={Plus} />
            Ajouter un coût de revient
          </Button>
        ) : null}
      </div>
      {permission.pending || permission.write ? null : (
        <Alert tone="info" title="Consultation seulement">
          Votre rôle consulte le coût de revient sans pouvoir le modifier.
        </Alert>
      )}
      <QueryState query={acquisitions} label="Chargement du coût de revient" title="Impossible de charger le coût de revient" onRetry={retry} />
      {acquisitions.data === undefined ? null : acquisitions.data.length === 0 ? (
        <EmptyState icon={Building2} title="Aucun coût de revient" description="Sans coût de revient, la rentabilité d’un bien est indiquée comme impossible à calculer, jamais comme nulle.">
          {permission.write ? <Button onClick={() => { setDialog({ editing: null }); }}>Ajouter un coût de revient</Button> : null}
        </EmptyState>
      ) : (
        <Card role="region" aria-label="Coûts de revient" className="gap-2">
          <Table scrollLabel="Coûts de revient, défilement horizontal">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Bien</TableHeaderCell>
                <TableHeaderCell>Acquis le</TableHeaderCell>
                <TableHeaderCell numeric>Prix d’achat</TableHeaderCell>
                <TableHeaderCell numeric>Frais d’acquisition</TableHeaderCell>
                <TableHeaderCell numeric>Frais d’agence</TableHeaderCell>
                <TableHeaderCell numeric>Travaux initiaux</TableHeaderCell>
                <TableHeaderCell numeric>Coût de revient</TableHeaderCell>
                {permission.write ? <TableHeaderCell>Actions</TableHeaderCell> : null}
              </TableRow>
            </TableHead>
            <TableBody>
              {acquisitions.data.map((acquisition) => (
                <TableRow key={acquisition.id}>
                  <TableCell strong>{names.get(acquisition.propertyId) ?? 'Bien'}</TableCell>
                  <TableCell>{formatDateFr(acquisition.acquiredOn)}</TableCell>
                  <TableCell numeric>{formatMoney(acquisition.price.amount, acquisition.price.currency)}</TableCell>
                  <TableCell numeric>{formatMoney(acquisition.acquisitionCosts.amount, acquisition.acquisitionCosts.currency)}</TableCell>
                  <TableCell numeric>{formatMoney(acquisition.agencyFees.amount, acquisition.agencyFees.currency)}</TableCell>
                  <TableCell numeric>{formatMoney(acquisition.initialWorks.amount, acquisition.initialWorks.currency)}</TableCell>
                  <TableCell numeric strong>{formatMoney(acquisition.cost.amount, acquisition.cost.currency)}</TableCell>
                  {permission.write ? (
                    <TableCell>
                      <Button variant="secondary" size="sm" onClick={() => { setDialog({ editing: acquisition }); }}>
                        <Icon icon={Pencil} />
                        Modifier
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <AcquisitionFormDialog open={dialog !== null} currency={currency.data ?? null} editing={dialog?.editing ?? null} onClose={() => { setDialog(null); }} />
    </>
  );
}
