'use client';

import { Badge, Button, Card, EmptyState, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { CursorPager, useCursorPages } from '../finances/rent/CursorPager';
import { ActionMenu, ListLoading, LoadError, PageHeader } from '../locataires/kit';
import type { ActionItem } from '../locataires/kit';
import { links } from '../locataires/kit/links';
import { SupplierDialog } from './dialogs/SupplierDialog';
import { useMaintenancePermissions, useNatureTerms, useSuppliers } from './hooks';
import { MaintenanceGate } from './MaintenanceGate';
import { supplierBadge } from './labels';
import { SUPPLIER_STATUSES } from './model';
import type { Supplier, SupplierStatus } from './model';
import { maintenancePaths } from './paths';
import { useRowAction } from './cards/rowActions';

const ALL = 'tous';
const statusOptions = [{ value: ALL, label: 'Tous les statuts' }, ...SUPPLIER_STATUSES.map((status) => ({ value: status, label: supplierBadge[status].label }))];
const isStatus = (value: string): value is SupplierStatus => SUPPLIER_STATUSES.some((status) => status === value);

export function SuppliersPage() {
  return (
    <MaintenanceGate>
      <SuppliersList />
    </MaintenanceGate>
  );
}

function SuppliersList() {
  const permissions = useMaintenancePermissions();
  const pages = useCursorPages();
  const run = useRowAction();
  const natures = useNatureTerms();
  const [status, setStatus] = useState(ALL);
  const [editing, setEditing] = useState<{ supplier: Supplier | null } | null>(null);
  const suppliers = useSuppliers({ cursor: pages.cursor, status: isStatus(status) ? status : undefined });
  const rows = suppliers.data?.items ?? [];
  const trades = (supplier: Supplier): string => supplier.tradeTermIds.map((id) => natures.data?.find((term) => term.id === id)?.label).filter((label) => label !== undefined).join(', ') || '—';

  const itemsFor = (supplier: Supplier): ActionItem[] => {
    if (!permissions.write) return [];
    return [
      { id: 'edit', label: 'Modifier', onSelect: () => { setEditing({ supplier }); } },
      ...(supplier.status === 'active' ? [{ id: 'suspend', label: 'Suspendre', onSelect: () => { run('Prestataire suspendu', (source) => source.changeSupplierStatus(supplier.id, 'suspend')); } }] : []),
      ...(supplier.status !== 'active' ? [{ id: 'activate', label: 'Réactiver', onSelect: () => { run('Prestataire réactivé', (source) => source.changeSupplierStatus(supplier.id, 'activate')); } }] : []),
      ...(supplier.status !== 'archived' ? [{ id: 'archive', label: 'Archiver', tone: 'danger' as const, separatorBefore: true, onSelect: () => { run('Prestataire archivé', (source) => source.changeSupplierStatus(supplier.id, 'archive')); } }] : []),
    ];
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Interventions', href: maintenancePaths.interventions }, { label: 'Prestataires' }]}
        title="Prestataires"
        subtitle="Artisans et entreprises que vous pouvez assigner aux interventions."
        actions={permissions.write ? <Button variant="primary" onClick={() => { setEditing({ supplier: null }); }}><Plus aria-hidden className="size-4" />Ajouter un prestataire</Button> : null}
      />
      <Card role="region" aria-label="Prestataires" className="gap-3">
        <div className="max-w-[260px]">
          <Select label="Statut" hideLabel placeholder="Statut" value={status} onValueChange={(value) => { setStatus(value); pages.reset(); }} options={statusOptions} />
        </div>
        {suppliers.isError ? <LoadError title={suppliers.error?.message ?? 'Les prestataires n’ont pas pu être chargés'} /> : null}
        {suppliers.isPending && !suppliers.isError ? <ListLoading label="Chargement des prestataires" /> : null}
        {suppliers.data && rows.length === 0 ? <EmptyState icon={Users} title="Aucun prestataire" description="Ajoutez un prestataire pour pouvoir l’assigner à une intervention." /> : null}
        {rows.length > 0 ? (
          <Table aria-label="Prestataires">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Nom</TableHeaderCell>
                <TableHeaderCell>Métiers</TableHeaderCell>
                <TableHeaderCell numeric>Délai de règlement</TableHeaderCell>
                <TableHeaderCell>Statut</TableHeaderCell>
                <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((supplier) => {
                const items = itemsFor(supplier);
                const name = supplier.name ?? 'Prestataire sans nom';
                return (
                  <TableRow key={supplier.id}>
                    <TableCell strong>
                      {name}
                      {supplier.preferred ? <span className="ml-1"><Badge tone="info">Préféré</Badge></span> : null}
                    </TableCell>
                    <TableCell>{trades(supplier)}</TableCell>
                    <TableCell numeric>{supplier.paymentTermsDays === null ? '—' : `${String(supplier.paymentTermsDays)} j`}</TableCell>
                    <TableCell><Badge tone={supplierBadge[supplier.status].tone}>{supplierBadge[supplier.status].label}</Badge></TableCell>
                    <TableCell>{items.length > 0 ? <ActionMenu label={`Actions pour ${name}`} items={items} /> : null}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : null}
        <CursorPager pages={pages} nextCursor={suppliers.data?.nextCursor ?? null} label="Pagination des prestataires" />
      </Card>
      {editing ? <SupplierDialog key={editing.supplier?.id ?? 'new'} supplier={editing.supplier} onClose={() => { setEditing(null); }} /> : null}
    </>
  );
}
