'use client';

import { ApiError } from '@eguardimmo/api';
import { Alert, Avatar, Button, StatCard } from '@eguardimmo/ui';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { FailureAlert } from '@/components/FailureAlert';
import { PageHeader } from '@/components/PageHeader';
import { NotFoundState, Skeleton } from '@/components/ScreenState';
import { EmptyLine, KeyValueList, ListRow, SectionCard } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate } from '@/lib/dates';
import { NOT_AVAILABLE, formatApiMoney, formatBasisPoints, formatFloor, formatSurface } from '@/tenant/format';
import {
  PHASE_VIEW,
  billingTimingLabel,
  noticeAuthorLabel,
  paymentMethodLabel,
  periodicityLabel,
  regimeLabel,
  roleLabel,
  unitDisplayName,
} from '@/tenant/labels';
import type { LeaseDetail, LeaseUnitView, Money, PartyView } from '@/tenant/model';
import { useLease } from '@/tenant/queries';
import { GraceBadge, leasePeriod } from './LeaseCard';
import { rentIndexation, termTotal } from './leaseSummary';

const PROCEDURES: readonly { href: string; label: string; activeOnly: boolean }[] = [
  { href: '/loyers/payer', label: 'Payer mon loyer', activeOnly: true },
  { href: '/documents', label: 'Mes documents', activeOnly: false },
  { href: '/assurance', label: 'Mon assurance', activeOnly: false },
  { href: '/etats-des-lieux', label: 'Mes états des lieux', activeOnly: false },
  { href: '/bail/conge', label: 'Donner congé', activeOnly: true },
];

const STACKED = 'max-sm:grid-cols-1!';
const yesNo = (value: boolean | null): string => (value === null ? NOT_AVAILABLE : value ? 'Oui' : 'Non');
const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '')
    .join('')
    .toUpperCase();

export function LeaseDetailScreen({ id }: { id: string }) {
  const lease = useLease(id);
  if (lease.data === undefined) {
    if (!lease.isError) return <Skeleton rows={4} />;
    if (lease.error instanceof ApiError && lease.error.status === 404) {
      return <NotFoundState title="Bail introuvable" backHref="/bail" backLabel="Retour à mes baux" />;
    }
    return <FailureAlert title="Ce bail n’a pas pu être chargé" error={lease.error} onRetry={() => void lease.refetch()} />;
  }
  return <LeaseContent lease={lease.data} />;
}

function money(value: Money | null): string {
  return value === null ? NOT_AVAILABLE : formatApiMoney(value);
}

function LeaseContent({ lease }: { lease: LeaseDetail }) {
  const phase = PHASE_VIEW[lease.phase];
  const rent = termTotal(lease.terms, 'rent');
  const charges = termTotal(lease.terms, 'charges');
  const deposit = termTotal(lease.terms, 'deposit');
  return (
    <>
      <PageHeader
        title={`Bail ${lease.reference}`}
        crumbs={[{ label: 'Mes baux', href: '/bail' }, { label: lease.reference }]}
        badge={
          <>
            <StatusBadge tone={phase.tone}>{phase.label}</StatusBadge>
            <GraceBadge lease={lease} />
          </>
        }
        subtitle={`${lease.organization.name ?? NOT_AVAILABLE} · ${leasePeriod(lease)}`}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href={`/loyers?bail=${lease.id}`}>Voir les loyers</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={`/loyers/quittances?bail=${lease.id}`}>Voir les quittances</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={`/loyers/paiements?bail=${lease.id}`}>Voir les paiements</Link>
            </Button>
          </>
        }
      />
      {lease.inGrace ? (
        <Alert tone="warning" title="Bail terminé : accès en lecture seule">
          {lease.accessUntil === null
            ? 'Ce bail est dans sa période de grâce.'
            : `Vous gardez l’accès à ce bail jusqu’au ${formatDate(lease.accessUntil)}.`}
        </Alert>
      ) : null}
      {lease.notice ? (
        <Alert tone="warning" title={`Congé reçu le ${formatDate(lease.notice.receivedOn)}`}>
          {lease.notice.givenBy === null ? '' : `Donné par ${noticeAuthorLabel(lease.notice.givenBy)}. `}
          {lease.notice.departureOn === null ? 'Date de départ : Non disponible.' : `Départ prévu le ${formatDate(lease.notice.departureOn)}.`}
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Loyer" value={money(rent)}>
          <span className="text-caption text-fg-subtle">Hors charges, au {formatDate(lease.termsOn)}</span>
        </StatCard>
        <StatCard label="Charges" value={money(charges)}>
          <span className="text-caption text-fg-subtle">Provisions ou forfait, au {formatDate(lease.termsOn)}</span>
        </StatCard>
        <StatCard label="Dépôt de garantie" value={money(deposit)} />
        <StatCard label="Fin du bail" value={lease.endsOn === null ? 'Sans date de fin' : formatDate(lease.endsOn)}>
          <span className="text-caption text-fg-subtle">{lease.tacitRenewal ? 'Reconduction tacite' : 'Sans reconduction tacite'}</span>
        </StatCard>
      </div>
      <SectionCard id="bail-demarches" title="Mes démarches">
        <ul className="flex flex-wrap gap-2">
          {PROCEDURES.filter((item) => !item.activeOnly || !lease.inGrace).map((item) => (
            <li key={item.href}>
              <Button variant="secondary" size="sm" asChild>
                <Link href={`${item.href}?bail=${lease.id}`}>{item.label}</Link>
              </Button>
            </li>
          ))}
        </ul>
      </SectionCard>
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard id="bail-conditions" title="Conditions du bail">
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
            <KeyValueList
              labelWidth="6.5rem"
              className={STACKED}
              items={[
                { label: 'Type', value: regimeLabel(lease.regimeKey) },
                { label: 'Durée', value: `${String(lease.durationMonths)} mois` },
                { label: 'Début', value: formatDate(lease.startsOn) },
                { label: 'Fin', value: lease.endsOn === null ? 'Sans date de fin' : formatDate(lease.endsOn) },
                { label: 'Signé le', value: lease.signedOn === null ? NOT_AVAILABLE : formatDate(lease.signedOn) },
              ]}
            />
            <KeyValueList
              labelWidth="6.5rem"
              className={STACKED}
              items={[
                {
                  label: 'Échéance',
                  value: `Paiement ${periodicityLabel(lease.periodicity)}, exigible le ${String(lease.dueDay)}, ${billingTimingLabel(lease.billingTiming)}`,
                },
                { label: 'Paiement', value: lease.paymentMethod === null ? NOT_AVAILABLE : paymentMethodLabel(lease.paymentMethod) },
                { label: 'Loyer indexé', value: yesNo(rentIndexation(lease.terms)) },
                { label: 'Prochaine révision', value: NOT_AVAILABLE },
              ]}
            />
          </div>
        </SectionCard>
        <SectionCard id="bail-parties" title="Parties au bail">
          <ul>
            {lease.parties.map((party) => (
              <PartyRow key={`${party.name}-${party.role}-${party.from}`} party={party} />
            ))}
          </ul>
        </SectionCard>
      </div>
      <SectionCard id="bail-financier" title={`Conditions financières au ${formatDate(lease.termsOn)}`}>
        {lease.terms.length === 0 ? (
          <EmptyLine>Aucune condition financière n’est en vigueur à cette date.</EmptyLine>
        ) : (
          <DataTable
            label="Conditions financières"
            rows={lease.terms}
            rowKey={(term) => `${term.key ?? 'inconnue'}-${String(term.amount.amount)}`}
            columns={[
              { id: 'composante', header: 'Composante', primary: true, cell: (term) => term.label ?? NOT_AVAILABLE },
              { id: 'montant', header: 'Montant', numeric: true, cell: (term) => formatApiMoney(term.amount) },
              { id: 'tva', header: 'TVA', numeric: true, cell: (term) => formatBasisPoints(term.vatBasisPoints) },
              { id: 'indexe', header: 'Indexé', cell: (term) => yesNo(term.indexed) },
            ]}
          />
        )}
      </SectionCard>
      <SectionCard id="bail-logement" title="Logement">
        {lease.units.length === 0 ? <EmptyLine>{NOT_AVAILABLE}</EmptyLine> : lease.units.map((line) => <UnitBlock key={`${line.unit?.reference ?? 'inconnu'}-${line.from}`} line={line} />)}
      </SectionCard>
    </>
  );
}

function PartyRow({ party }: { party: PartyView }) {
  const details = [roleLabel(party.role), party.jointLiability ? 'solidaire' : null, party.to === null ? `depuis le ${formatDate(party.from)}` : `du ${formatDate(party.from)} au ${formatDate(party.to)}`];
  return (
    <ListRow
      leading={<Avatar initials={initialsOf(party.name)} size="md" />}
      title={party.isMe ? `${party.name} (vous)` : party.name}
      detail={details.filter((part): part is string => part !== null).join(' · ')}
    />
  );
}

function UnitBlock({ line }: { line: LeaseUnitView }) {
  const unit = line.unit;
  return (
    <div className="border-t border-line py-3 first:border-t-0 first:pt-0">
      <KeyValueList
        labelWidth="6.5rem"
        className={STACKED}
        items={[
          { label: 'Lot', value: unit === null ? NOT_AVAILABLE : `${unitDisplayName(unit)}${line.isMain ? ' (principal)' : ''}` },
          { label: 'Immeuble', value: unit === null ? NOT_AVAILABLE : unit.propertyName },
          { label: 'Adresse', value: unit === null ? NOT_AVAILABLE : unit.address },
          { label: 'Étage', value: unit === null ? NOT_AVAILABLE : formatFloor(unit.floor) },
          { label: 'Surface', value: unit === null ? NOT_AVAILABLE : formatSurface(unit.surfaceHundredths) },
          {
            label: 'Occupation',
            value: line.to === null ? `Depuis le ${formatDate(line.from)}` : `Du ${formatDate(line.from)} au ${formatDate(line.to)}`,
          },
        ]}
      />
    </div>
  );
}
