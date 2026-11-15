'use client';

import { Badge, StatCard } from '@eguardimmo/ui';
import { HandCoins } from 'lucide-react';
import { leaseAcomptes } from './acomptes';
import type { AcompteEntry, AcompteImputation, LeaseAcomptes } from './acomptes';
import { LoadError, LinkButton, SectionCard, useGestionNavigation } from '../locataires/kit';
import { formatDateFr } from '../locataires/kit/dates';
import { money } from '../locataires/kit/money';
import { MODE_LABELS, NATURE_LABELS } from '../finances/labels';
import { financesPaths } from '../finances/paths';
import { useFinances } from '../finances/queries';

export interface LeaseAcomptesQuery {
  data: LeaseAcomptes | undefined;
  isError: boolean;
}

export function useLeaseAcomptes(leaseReference: string): LeaseAcomptesQuery {
  const finances = useFinances();
  return { data: finances.data ? leaseAcomptes(finances.data, leaseReference) : undefined, isError: finances.isError };
}

export function AvailableAcomptesCard({ query }: { query: LeaseAcomptesQuery }) {
  const available = query.data?.available ?? 0;
  const caption = query.isError ? 'Indisponible' : !query.data ? 'Chargement' : available > 0 ? 'À imputer sur la prochaine échéance' : 'Aucun crédit à imputer';
  return (
    <StatCard label="Acomptes disponibles" value={query.data ? money(available) : '—'}>
      <span className="text-caption text-fg-subtle">{caption}</span>
    </StatCard>
  );
}

export function pendingReceiptsDetail(data: LeaseAcomptes): string {
  const issued = data.entries.filter((entry) => entry.recuId !== null).length;
  if (issued === 0) return 'Aucun reçu d’acompte émis';
  return data.pending === 0 ? `${String(issued)} émis, aucun en attente de solde` : `${String(issued)} émis, ${String(data.pending)} en attente de solde`;
}

function imputationLabel(imputation: AcompteImputation): string {
  switch (imputation.kind) {
    case 'echeance':
      return imputation.resteDu > 0 ? `Imputé sur ${imputation.libelle}, reste dû ${money(imputation.resteDu)}` : `Imputé sur ${imputation.libelle}, échéance soldée`;
    case 'depot':
      return 'Versé au dépôt de garantie';
    case 'non_comptabilise':
      return 'Non comptabilisé, aucune imputation';
    case 'credit':
      return 'Crédit disponible, non imputé';
  }
}

const linkClass = 'text-caption font-medium text-action-on-subtle underline-offset-2 hover:underline';

function AcompteLine({ entry }: { entry: AcompteEntry }) {
  const { Link } = useGestionNavigation();
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line py-2 first:border-t-0">
      <span className="flex min-w-0 flex-col">
        <b className="text-body-strong text-fg">{`${NATURE_LABELS[entry.nature]}, ${money(entry.montant)}`}</b>
        <span className="text-caption text-fg-subtle">{`${formatDateFr(entry.date)}, ${MODE_LABELS[entry.mode]}. ${imputationLabel(entry.imputation)}`}</span>
      </span>
      <span className="flex flex-wrap items-center gap-2">
        {entry.enAttenteDeSolde ? <Badge tone="warning">En attente de solde</Badge> : null}
        {entry.recuId && entry.recuNumero ? (
          <Link href={financesPaths.recu(entry.recuId)} className={linkClass}>{`Reçu ${entry.recuNumero}`}</Link>
        ) : (
          <span className="text-caption text-fg-subtle">Sans reçu</span>
        )}
      </span>
    </li>
  );
}

export function AcomptesList({ query }: { query: LeaseAcomptesQuery }) {
  const data = query.data;
  return (
    <SectionCard
      id="echeancier-acomptes"
      title="Acomptes du bail"
      aside={data?.bailId ? <LinkButton href={`${financesPaths.acompte}?bail=${data.bailId}`} size="sm" icon={HandCoins}>Enregistrer un acompte</LinkButton> : undefined}
    >
      {query.isError ? <LoadError title="Les acomptes n’ont pas pu être chargés" /> : null}
      {data?.entries.length === 0 ? <p className="py-2 text-body text-fg-muted">Aucun acompte enregistré pour ce bail.</p> : null}
      {data && data.entries.length > 0 ? (
        <ul>
          {data.entries.map((entry) => (
            <AcompteLine key={entry.id} entry={entry} />
          ))}
        </ul>
      ) : null}
    </SectionCard>
  );
}
