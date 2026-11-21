'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@eguardimmo/ui';
import { useLeaseBalance } from './hooks';
import { moneyText } from './labels';
import { rentPaths } from './paths';
import { LedgerLines, ListLoading, LoadError, useGestionNavigation } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';

export function LeaseBalanceCard({ leaseId, label }: { leaseId: string; label?: string }) {
  const balance = useLeaseBalance(leaseId);
  const { Link } = useGestionNavigation();
  return (
    <Card role="region" aria-label={label ? `Solde du bail ${label}` : 'Solde du bail'} className="gap-3">
      <CardHeader><CardTitle as="h2">{label ? `Solde du bail ${label}` : 'Solde du bail'}</CardTitle></CardHeader>
      <CardContent>
        {balance.isError ? <LoadError title={balance.error?.message ?? 'Le solde n’a pas pu être chargé'} /> : null}
        {balance.isPending && !balance.isError ? <ListLoading label="Chargement du solde" /> : null}
        {balance.data ? (
          <LedgerLines
            lines={[
              { label: 'Solde au grand livre', value: moneyText(balance.data.balance) },
              { label: 'En retard', value: moneyText(balance.data.overdue) },
              { label: 'Avance du locataire', value: moneyText(balance.data.advance) },
              { label: 'Échéances impayées', value: String(balance.data.unpaidCount) },
              { label: 'Plus ancienne échéance impayée', value: balance.data.oldestUnpaidDueDate ? formatDateFr(balance.data.oldestUnpaidDueDate) : '—' },
            ]}
          />
        ) : null}
        <p className="mt-2 text-caption">
          <Link href={`${rentPaths.payments}?bail=${encodeURIComponent(leaseId)}`} className="text-action-on-subtle underline-offset-2 hover:underline">Voir les paiements de ce bail</Link>
        </p>
      </CardContent>
    </Card>
  );
}
