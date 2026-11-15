'use client';

import { Badge, TableCell, TableRow } from '@eguardimmo/ui';
import type { BadgeTone } from '@eguardimmo/ui';
import { FileText, Receipt } from 'lucide-react';
import type { Installment, Lease } from './schemas';
import { courriersPaths, noticeIdOf, receiptIdOf } from '../courriers/paths';
import { ItemRow, LinkButton, SectionCard, useGestionNavigation } from '../locataires/kit';
import { formatDateFr, monthLabel } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { money } from '../locataires/kit/money';

export const stateBadge: Record<Installment['state'], { label: string; tone: BadgeTone }> = {
  paye: { label: 'Payé', tone: 'success' },
  partiel: { label: 'Partiel', tone: 'warning' },
  impaye: { label: 'Impayé', tone: 'danger' },
  a_emettre: { label: 'À émettre', tone: 'info' },
};

const linkClass = 'text-caption font-medium text-action-on-subtle underline-offset-2 hover:underline';

export function arrearsByInstallment(rows: readonly Installment[]): Map<string, number> {
  const result = new Map<string, number>();
  let running = 0;
  for (const row of [...rows].sort((a, b) => a.month.localeCompare(b.month))) {
    const remaining = row.called - row.received;
    running = row.state === 'a_emettre' ? remaining : running + remaining;
    result.set(row.id, running);
  }
  return result;
}

export function InstallmentRow({ row, lease, arrears }: { row: Installment; lease: Lease; arrears: number }) {
  const { Link } = useGestionNavigation();
  const badge = stateBadge[row.state];
  const remaining = row.called - row.received;
  return (
    <TableRow>
      <TableCell strong>{monthLabel(row.month)}</TableCell>
      <TableCell>{formatDateFr(row.due)}</TableCell>
      <TableCell numeric>{money(row.called)}</TableCell>
      <TableCell numeric>{money(row.received)}</TableCell>
      <TableCell numeric className={remaining > 0 ? 'text-fg-danger' : undefined}>{money(remaining)}</TableCell>
      <TableCell numeric>{money(arrears)}</TableCell>
      <TableCell>
        <span className="flex flex-wrap items-center gap-1">
          <Badge tone={badge.tone}>{badge.label}</Badge>
          {row.lateSettled ? <Badge tone="neutral">Réglé en retard</Badge> : null}
        </span>
      </TableCell>
      <TableCell>
        {row.receiptNumber ? (
          <Link href={courriersPaths.quittance(receiptIdOf(row.receiptNumber))} className={linkClass}>{row.receiptNumber}</Link>
        ) : (
          <span className="text-caption text-fg-subtle">{row.state === 'a_emettre' ? 'Après solde' : row.state === 'paye' ? 'Émise' : 'Non émise'}</span>
        )}
      </TableCell>
      <TableCell>
        <span className="flex items-center justify-end gap-1.5">
          {row.state === 'a_emettre' ? (
            <Link href={courriersPaths.notice(noticeIdOf(lease.id, row.month))} className={linkClass}>Avis d’échéance</Link>
          ) : null}
          {row.state === 'impaye' || row.state === 'partiel' ? (
            <LinkButton href={links.newCourrier({ modele: 'relance-de-loyer-impaye', locataire: lease.tenantIds[0], bien: lease.unitId })} size="sm" variant="primary">Relancer</LinkButton>
          ) : null}
        </span>
      </TableCell>
    </TableRow>
  );
}

const ALLOCATION = [
  { title: 'Dettes les plus anciennes', detail: 'Les impayés les plus anciens sont soldés avant l’échéance en cours' },
  { title: 'Échéance en cours', detail: 'Loyer, puis provisions sur charges' },
  { title: 'Frais refacturés', detail: 'Frais de recouvrement et de relance' },
  { title: 'Crédit reporté', detail: 'Le surplus devient un acompte' },
];

export function AllocationOrder() {
  return (
    <SectionCard id="echeancier-imputation" title="Ordre d’imputation des paiements">
      <ol className="flex flex-col">
        {ALLOCATION.map((step, index) => (
          <li key={step.title} className="flex items-start gap-2.5 border-t border-line py-2 first:border-t-0">
            <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-caption font-semibold text-fg-muted">{index + 1}</span>
            <span className="flex min-w-0 flex-col">
              <b className="text-body-strong text-fg">{step.title}</b>
              <span className="text-caption text-fg-subtle">{step.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}

export function ScheduleDocuments({ rows, priorDebt }: { rows: readonly Installment[]; priorDebt: number }) {
  const next = rows.find((row) => row.state === 'a_emettre');
  const emitted = rows.filter((row) => row.state !== 'a_emettre');
  const receipts = emitted.filter((row) => row.state === 'paye').sort((a, b) => b.month.localeCompare(a.month));
  const lastReceipt = receipts[0];
  return (
    <SectionCard id="echeancier-documents" title="Documents de l’échéancier">
      <ul>
        {next ? (
          <ItemRow
            icon={FileText}
            title={`Avis d’échéance de ${monthLabel(next.month).toLowerCase()}`}
            detail={priorDebt > 0 ? `Dettes antérieures de ${money(priorDebt)} incluses` : 'Aucune dette antérieure'}
            badge={{ label: 'À envoyer', tone: 'info' }}
          />
        ) : null}
        <ItemRow
          icon={Receipt}
          title="Quittances émises"
          detail={`${String(receipts.length)} sur ${String(emitted.length)}${lastReceipt ? `, la dernière en ${monthLabel(lastReceipt.month).toLowerCase()}` : ''}`}
          trailing={<LinkButton href={courriersPaths.quittances} size="sm">Tout voir</LinkButton>}
        />
      </ul>
    </SectionCard>
  );
}
