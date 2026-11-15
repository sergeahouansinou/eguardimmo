'use client';

import { Badge, Button, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import type { BadgeTone } from '@eguardimmo/ui';
import type { Tone } from '@eguardimmo/shell';
import { House, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLeaseLookups } from './BauxParts';
import { bauxPaths } from './paths';
import type { Installment, Lease } from './schemas';
import { ItemRow, LinkButton, NoRows, SectionCard } from '../locataires/kit';
import { formatDateFr } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { money } from '../locataires/kit/money';
import { locatairesPaths } from '../locataires/paths';

const stateBadge: Record<Installment['state'], { label: string; tone: BadgeTone }> = {
  paye: { label: 'Payé', tone: 'success' },
  partiel: { label: 'Partiel', tone: 'warning' },
  impaye: { label: 'Impayé', tone: 'danger' },
  a_emettre: { label: 'À émettre', tone: 'info' },
};

export function LeaseParties({ lease }: { lease: Lease }) {
  const lookups = useLeaseLookups();
  return (
    <SectionCard id="bail-parties" title="Parties au bail">
      <ul>
        {lease.tenantIds.map((tenantId) => (
          <ItemRow
            key={tenantId}
            icon={User}
            title={lookups.tenantName(tenantId)}
            detail="Locataire"
            trailing={<LinkButton href={locatairesPaths.detail(tenantId)} size="sm">Fiche locataire</LinkButton>}
          />
        ))}
        <ItemRow
          icon={House}
          title={lookups.unitLabel(lease.unitId)}
          detail="Bien loué"
          trailing={<LinkButton href={links.unit(lease.unitId)} size="sm">Fiche du bien</LinkButton>}
        />
      </ul>
    </SectionCard>
  );
}

export function LatestInstallments({ lease, installments }: { lease: Lease; installments: readonly Installment[] }) {
  const issued = installments.filter((row) => row.state !== 'a_emettre').sort((a, b) => b.month.localeCompare(a.month));
  const paid = issued.filter((row) => row.state === 'paye').length;
  const late = issued.filter((row) => row.lateSettled).length;
  const unpaid = issued.filter((row) => row.state === 'impaye' || row.state === 'partiel').length;
  return (
    <SectionCard
      id="bail-echeances"
      title="Dernières échéances"
      aside={<LinkButton href={bauxPaths.schedule(lease.id)} size="sm" variant="ghost">{`Tout voir, ${String(issued.length)}`}</LinkButton>}
    >
      {issued.length === 0 ? (
        <NoRows>Aucune échéance émise pour le moment.</NoRows>
      ) : (
        <>
          <p className="flex flex-wrap gap-2 text-caption text-fg-subtle">
            <span>{`${String(paid)} payée${paid > 1 ? 's' : ''}`}</span>
            <span>{`${String(late)} réglée${late > 1 ? 's' : ''} en retard`}</span>
            <span>{`${String(unpaid)} impayée${unpaid > 1 ? 's' : ''}`}</span>
          </p>
          <Table aria-label="Dernières échéances">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Échéance</TableHeaderCell>
                <TableHeaderCell numeric>Appelé</TableHeaderCell>
                <TableHeaderCell numeric>Encaissé</TableHeaderCell>
                <TableHeaderCell numeric>Reste</TableHeaderCell>
                <TableHeaderCell>État</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {issued.slice(0, 3).map((row) => (
                <TableRow key={row.id}>
                  <TableCell strong>{formatDateFr(row.due)}</TableCell>
                  <TableCell numeric>{money(row.called)}</TableCell>
                  <TableCell numeric>{money(row.received)}</TableCell>
                  <TableCell numeric>{money(row.called - row.received)}</TableCell>
                  <TableCell>
                    <Badge tone={stateBadge[row.state].tone}>{stateBadge[row.state].label}</Badge>
                    {row.paidOn ? <span className="ml-1 text-caption text-fg-subtle">{`le ${formatDateFr(row.paidOn).slice(0, 5)}`}</span> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </SectionCard>
  );
}

interface PreviewEntry {
  id: string;
  title: string;
  detail: string;
  tone: Tone;
  badge?: { label: string; tone: Tone };
}

export function LeasePreview({
  id,
  title,
  icon,
  entries,
  onSeeAll,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  entries: readonly PreviewEntry[];
  onSeeAll: () => void;
}) {
  return (
    <SectionCard id={id} title={title} aside={<Button variant="ghost" size="sm" onClick={onSeeAll}>{`Tout voir, ${String(entries.length)}`}</Button>}>
      {entries.length === 0 ? <NoRows>Rien à afficher pour le moment.</NoRows> : null}
      <ul>
        {entries.slice(0, 3).map((entry) => (
          <ItemRow key={entry.id} icon={icon} tone={entry.tone} title={entry.title} detail={entry.detail} badge={entry.badge} />
        ))}
      </ul>
    </SectionCard>
  );
}

