'use client';

import { Alert, Badge, Button, Card, EmptyState, Icon, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { Landmark, Plus } from 'lucide-react';
import { useState } from 'react';
import { formatMoney } from '../../format/money';
import { LinkButton, PageHeader, useGestionNavigation } from '../locataires/kit';
import { formatDateFr } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { QueryState } from '../orgapi/QueryState';
import { useOrgPermission, useOrgPropertyChoices } from '../orgapi/hooks';
import { InvestmentsGate } from './InvestmentsGate';
import { LoanFormDialog } from './LoanFormDialog';
import { useInvestmentsCurrency, useInvestmentsRetry, useLoans } from './hooks';
import { purposeLabel, rateLabel, statusLabel, statusTone } from './labels';
import { LOAN_STATUSES, NO_LOAN_FILTERS } from './model';
import type { LoanFilters, LoanStatus } from './model';
import { investmentsPaths } from './paths';

const ALL = 'all';

export function LoansPage() {
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances', href: '/finances' }, { label: 'Prêts immobiliers' }]}
        title="Prêts immobiliers"
        subtitle="Vos emprunts, à titre informatif : le serveur calcule l’échéancier, rien n’est écrit au grand livre."
      />
      <InvestmentsGate>
        <LoansBody />
      </InvestmentsGate>
    </>
  );
}

function LoansBody() {
  const { Link } = useGestionNavigation();
  const [filters, setFilters] = useState<LoanFilters>(NO_LOAN_FILTERS);
  const [creating, setCreating] = useState(false);
  const retry = useInvestmentsRetry();
  const loans = useLoans(filters);
  const unfiltered = useLoans(NO_LOAN_FILTERS, filters !== NO_LOAN_FILTERS);
  const properties = useOrgPropertyChoices();
  const currency = useInvestmentsCurrency();
  const permission = useOrgPermission('investments');
  const names = new Map((properties.data ?? []).map((property) => [property.id, property.name]));
  const replaceable = (unfiltered.data ?? loans.data ?? []).filter((loan) => loan.status === 'active');
  const filtered = filters.propertyId !== null || filters.status !== null;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-wrap items-end gap-2">
          <Select
            label="Bien"
            placeholder="Tous les biens"
            value={filters.propertyId ?? ALL}
            onValueChange={(value) => { setFilters({ ...filters, propertyId: value === ALL ? null : value }); }}
            options={[{ value: ALL, label: 'Tous les biens' }, ...(properties.data ?? []).map((property) => ({ value: property.id, label: property.name }))]}
          />
          <Select
            label="Statut"
            placeholder="Tous les statuts"
            value={filters.status ?? ALL}
            onValueChange={(value) => { setFilters({ ...filters, status: LOAN_STATUSES.find((status) => status === value) ?? null }); }}
            options={[{ value: ALL, label: 'Tous les statuts' }, ...LOAN_STATUSES.map((status: LoanStatus) => ({ value: status, label: statusLabel[status] }))]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LinkButton href={investmentsPaths.acquisitions}>Coût de revient des biens</LinkButton>
          {permission.write ? (
            <Button onClick={() => { setCreating(true); }}>
              <Icon icon={Plus} />
              Nouveau prêt
            </Button>
          ) : null}
        </div>
      </div>
      {permission.pending || permission.write ? null : (
        <Alert tone="info" title="Consultation seulement">
          Votre rôle consulte les prêts sans pouvoir les créer ni les modifier.
        </Alert>
      )}
      <QueryState query={loans} label="Chargement des prêts" title="Impossible de charger les prêts" onRetry={retry} />
      {loans.data === undefined ? null : loans.data.length === 0 ? (
        <EmptyState icon={Landmark} title={filtered ? 'Aucun prêt pour ces filtres' : 'Aucun prêt enregistré'} description={filtered ? 'Modifiez ou retirez les filtres.' : 'Ajoutez un emprunt pour suivre son échéancier et déclarer les intérêts déductibles.'}>
          {permission.write && !filtered ? <Button onClick={() => { setCreating(true); }}>Nouveau prêt</Button> : null}
        </EmptyState>
      ) : (
        <Card role="region" aria-label="Prêts" className="gap-2">
          <Table scrollLabel="Liste des prêts, défilement horizontal">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Prêteur</TableHeaderCell>
                <TableHeaderCell>Bien</TableHeaderCell>
                <TableHeaderCell>Objet</TableHeaderCell>
                <TableHeaderCell numeric>Capital emprunté</TableHeaderCell>
                <TableHeaderCell numeric>Taux</TableHeaderCell>
                <TableHeaderCell numeric>Durée</TableHeaderCell>
                <TableHeaderCell numeric>Restant dû selon l’échéancier</TableHeaderCell>
                <TableHeaderCell>Statut</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loans.data.map((loan) => (
                <TableRow key={loan.id}>
                  <TableCell strong>
                    <Link href={investmentsPaths.loan(loan.id)} className="text-action-on-subtle underline underline-offset-2">{loan.lenderLabel}</Link>
                  </TableCell>
                  <TableCell>{names.get(loan.propertyId) ?? 'Bien'}</TableCell>
                  <TableCell>{purposeLabel[loan.purpose]}</TableCell>
                  <TableCell numeric>{formatMoney(loan.principal.amount, loan.principal.currency)}</TableCell>
                  <TableCell numeric>{rateLabel(loan.nominalRate)}</TableCell>
                  <TableCell numeric>{`${String(loan.termMonths)} mois`}</TableCell>
                  <TableCell numeric>{`${formatMoney(loan.outstanding.amount.amount, loan.outstanding.amount.currency)} au ${formatDateFr(loan.outstanding.asOf)}`}</TableCell>
                  <TableCell>
                    <Badge tone={statusTone[loan.status]}>{statusLabel[loan.status]}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-caption text-fg-subtle">Le capital restant dû est une donnée contractuelle selon l’échéancier, jamais un solde comptable.</p>
        </Card>
      )}
      <LoanFormDialog open={creating} currency={currency.data ?? null} replaceable={replaceable} onClose={() => { setCreating(false); }} />
    </>
  );
}
