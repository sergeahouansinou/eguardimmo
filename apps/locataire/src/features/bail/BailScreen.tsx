'use client';

import { Alert, Avatar, Button, Card, CardHeader, CardTitle, Icon, StatCard } from '@eguardimmo/ui';
import { Building2, DoorOpen, Download, FileSignature, House, TrendingUp, ClipboardCheck } from 'lucide-react';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { Async3 } from '@/components/ScreenState';
import { CardLink, IconTile, KeyValueList, ListRow, SectionCard } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import { useDocuments, useInstallments, useLease } from '@/data/queries';
import type { DemoDocument, Lease } from '@/data/schemas/logement';
import type { Installment } from '@/data/schemas/loyers';
import { formatDate } from '@/lib/dates';
import { downloadDemoPdf } from '@eguardimmo/shell';
import { formatMoney } from '@/lib/money';
import { installmentStatus } from '../shared/status';

const DOC_ICONS: Record<string, typeof FileSignature> = {
  'bail-signe': FileSignature,
  'etat-des-lieux-d-entree': ClipboardCheck,
  'avis-de-revision-du-loyer': TrendingUp,
};

export function BailScreen() {
  const lease = useLease();
  const installments = useInstallments();
  const documents = useDocuments();
  return (
    <Async3 a={lease} b={installments} c={documents} errorTitle="Votre bail n’a pas pu être chargé">
      {(leaseData, items, docs) => <BailContent lease={leaseData} items={items} docs={docs} />}
    </Async3>
  );
}

function scheduleRows(items: readonly Installment[]): Installment[] {
  const upcoming = items.filter((item) => item.status === 'a_venir').slice(0, 1);
  const recent = items.filter((item) => item.status !== 'a_venir').slice(-3);
  return [...upcoming, ...recent.reverse()];
}

function BailContent({ lease, items, docs }: { lease: Lease; items: Installment[]; docs: DemoDocument[] }) {
  const rows = scheduleRows(items);
  const leaseDocs = lease.documentIds
    .map((id) => docs.find((doc) => doc.id === id))
    .filter((doc): doc is DemoDocument => doc !== undefined);
  const totalCents = lease.rentCents + lease.provisionsCents;
  const ended = lease.status === 'conge_donne';
  return (
    <>
      <PageHeader
        title="Mon bail"
        crumbs={[{ label: 'Mon logement' }, { label: 'Mon bail' }]}
        badge={<StatusBadge tone={ended ? 'warning' : 'success'}>{ended ? 'Congé donné' : 'En cours'}</StatusBadge>}
        subtitle={`${lease.usage} · du ${formatDate(lease.startOn)} au ${formatDate(lease.endOn)}`}
        actions={
          <>
            {ended ? null : (
              <Button variant="secondary" asChild>
                <Link href="/bail/conge">
                  <Icon icon={DoorOpen} />
                  Donner congé
                </Link>
              </Button>
            )}
            <Button onClick={() => { downloadDemoPdf('bail-signe.pdf', 'Bail signé', [lease.id, lease.landlord.name]); }}>
              <Icon icon={Download} />
              Télécharger le bail
            </Button>
          </>
        }
      />
      {lease.notice ? (
        <Alert tone="warning" title={`Congé donné le ${formatDate(lease.notice.sentOn)}`}>
          Départ prévu le {formatDate(lease.notice.departureOn)}. Un état des lieux de sortie vous sera proposé par {lease.landlord.name}.
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Loyer charges comprises" value={formatMoney(totalCents)}>
          <span className="text-caption text-fg-subtle">{formatMoney(lease.rentCents)} de loyer et {formatMoney(lease.provisionsCents)} de provisions</span>
        </StatCard>
        <StatCard label="Dépôt de garantie" value={formatMoney(lease.depositCents)}>
          <span className="text-caption text-fg-subtle">Versé le {formatDate(lease.depositPaidOn)}</span>
        </StatCard>
        <StatCard label="Prochaine révision" value={formatDate(lease.revision.nextOn)}>
          <span className="text-caption text-fg-subtle">{lease.revision.note}</span>
        </StatCard>
        <StatCard label="Fin du bail" value={formatDate(lease.endOn)}>
          <span className="text-caption text-fg-subtle">{lease.renewal}</span>
        </StatCard>
      </div>
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard id="bail-conditions" title="Conditions du bail">
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
            <KeyValueList
              labelWidth="6.5rem"
              items={[
                { label: 'Type', value: lease.regime },
                { label: 'Durée', value: lease.duration },
                { label: 'Début', value: formatDate(lease.startOn) },
                { label: 'Fin', value: formatDate(lease.endOn) },
                { label: 'Préavis', value: lease.noticeZoneLabel },
              ]}
            />
            <KeyValueList
              labelWidth="6.5rem"
              items={[
                { label: 'Loyer', value: `${formatMoney(lease.rentCents)}, hors charges` },
                { label: 'Provisions', value: `${formatMoney(lease.provisionsCents)}, régularisées chaque année` },
                { label: 'Échéance', value: lease.dueLabel },
                { label: 'Révision', value: 'IRL, au 1er avril' },
                { label: 'Dépôt', value: `${formatMoney(lease.depositCents)}, versé le ${formatDate(lease.depositPaidOn)}` },
              ]}
            />
          </div>
        </SectionCard>
        <SectionCard id="bail-parties" title="Parties au bail">
          <ul>
            <ListRow icon={Building2} title={lease.landlord.name} detail={`Bailleur · ${lease.landlord.address}`} />
            <ListRow leading={<Avatar initials={lease.tenantInitials} size="md" />} title={lease.tenantName} detail="Locataire · vous" />
            <ListRow
              leading={<IconTile icon={House} />}
              title={lease.property.label}
              detail={`${lease.property.type}, ${lease.property.surface} · ${lease.property.floor}`}
            />
          </ul>
        </SectionCard>
      </div>
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard
          id="bail-echeancier"
          title="Échéancier"
          aside={<CardLink href="/loyers">Tout voir, {items.filter((item) => item.status !== 'a_venir').length}</CardLink>}
        >
          <DataTable
            label="Échéancier"
            rows={rows}
            rowKey={(item) => item.id}
            columns={[
              { id: 'echeance', header: 'Échéance', primary: true, cell: (item) => formatDate(item.dueOn) },
              { id: 'loyer', header: 'Loyer', numeric: true, cell: (item) => formatMoney(item.rentCents) },
              { id: 'provisions', header: 'Provisions', numeric: true, cell: (item) => formatMoney(item.provisionsCents) },
              { id: 'total', header: 'Total', numeric: true, cell: (item) => formatMoney(item.rentCents + item.provisionsCents) },
              {
                id: 'etat',
                header: 'État',
                cell: (item) => {
                  const view = installmentStatus(item.status);
                  const label = item.status === 'paye' && item.paidOn ? `Payé le ${formatDate(item.paidOn).slice(0, 5)}` : view.label;
                  return <StatusBadge tone={view.tone}>{label}</StatusBadge>;
                },
              },
            ]}
          />
        </SectionCard>
        <Card role="region" aria-labelledby="bail-documents" className="px-4 py-3">
          <CardHeader>
            <CardTitle as="h2" id="bail-documents">Documents du bail</CardTitle>
          </CardHeader>
          <ul>
            {leaseDocs.map((doc) => (
              <ListRow
                key={doc.id}
                icon={DOC_ICONS[doc.id] ?? FileSignature}
                title={doc.name}
                detail={doc.detail}
                trailing={
                  <Button variant="link" size="sm" onClick={() => { downloadDemoPdf(`${doc.id}.pdf`, doc.name, [doc.detail]); }}>
                    Télécharger
                  </Button>
                }
              />
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

