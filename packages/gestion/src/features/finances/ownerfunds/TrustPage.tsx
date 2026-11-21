'use client';

import { Alert, Badge, Button, Card, EmptyState, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { Landmark } from 'lucide-react';
import { useState } from 'react';
import { TransferDialog } from './TransferDialog';
import type { TransferMode } from './TransferDialog';
import { useAttemptKey } from './attemptKey';
import { useConfirmDeposit, useCoverage, useDeposits, useOwnerFundsPermissions } from './hooks';
import { depositBadge, moneyText } from './labels';
import type { TrustDeposit } from './model';
import { ConfirmAction, OwnerFundsGate, OwnerFundsSections, RoleNotice } from './parts';
import { CursorPager, useCursorPages } from '../rent/CursorPager';
import { LedgerLines, ListLoading, LoadError, PageHeader, useNotify } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';

export function TrustPage() {
  return (
    <OwnerFundsGate>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Fonds de tiers' }]}
        title="Fonds de tiers"
        subtitle="Cantonnement : le compte de tiers doit couvrir ce que l’agence doit aux mandants et aux locataires."
      />
      <OwnerFundsSections current="trust" />
      <CoverageCard />
      <DepositsCard />
    </OwnerFundsGate>
  );
}

function CoverageCard() {
  const permissions = useOwnerFundsPermissions();
  const coverage = useCoverage();
  const [transfer, setTransfer] = useState<TransferMode | null>(null);
  const data = coverage.data;

  return (
    <Card role="region" aria-label="Couverture du cantonnement" className="gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-block-title text-fg">
          Couverture du cantonnement
          {data ? <Badge tone={data.covered ? 'success' : 'danger'}>{data.covered ? 'Couvert' : 'Écart de cantonnement'}</Badge> : null}
        </h2>
        {permissions.sensitive && data ? (
          <span className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={!data.covered || data.surplus.amount <= 0} onClick={() => { setTransfer('withdraw'); }}>Prélever les honoraires</Button>
            <Button size="sm" onClick={() => { setTransfer('deposit'); }}>Enregistrer un apport</Button>
          </span>
        ) : null}
      </div>
      {coverage.isError ? <LoadError title={coverage.error?.message ?? 'La couverture du cantonnement n’a pas pu être chargée'} /> : null}
      {coverage.isPending && !coverage.isError ? <ListLoading label="Chargement de la couverture du cantonnement" /> : null}
      {data && !data.covered ? (
        <Alert tone="danger" title="Écart de cantonnement">
          Les fonds du compte de tiers ne couvrent pas les sommes dues. Les reversements, les prélèvements d’honoraires et la clôture du mois sont bloqués jusqu’à un apport sur le compte de tiers ; les encaissements restent comptabilisés.
        </Alert>
      ) : null}
      {data ? (
        <LedgerLines
          lines={[
            { label: 'Fonds sur le compte de tiers', value: moneyText(data.trustBank) },
            { label: 'Dû aux mandants', value: moneyText(data.ownerPayable) },
            { label: 'Reversements en cours', value: moneyText(data.payoutsInTransit) },
            { label: 'Dépôts de garantie', value: moneyText(data.securityDeposits) },
            { label: 'Avances des locataires', value: moneyText(data.tenantAdvances) },
            { label: 'Fonds à couvrir', value: moneyText(data.required) },
          ]}
          total={{ label: 'Excédent, part de l’agence', value: moneyText(data.surplus) }}
        />
      ) : null}
      {!permissions.sensitive ? <RoleNotice>Le prélèvement des honoraires et les apports sont réservés au propriétaire, à l’administrateur et au comptable, avec double authentification.</RoleNotice> : null}
      <TransferDialog mode={transfer ?? 'withdraw'} currency={data?.trustBank.currency ?? 'EUR'} open={transfer !== null} onClose={() => { setTransfer(null); }} />
    </Card>
  );
}

function DepositsCard() {
  const permissions = useOwnerFundsPermissions();
  const pages = useCursorPages();
  const deposits = useDeposits(pages.cursor);
  const confirm = useConfirmDeposit();
  const keyFor = useAttemptKey();
  const notify = useNotify();
  const [confirming, setConfirming] = useState<TrustDeposit | null>(null);
  const rows = deposits.data?.items ?? [];

  return (
    <Card role="region" aria-label="Apports au compte de tiers" className="gap-3">
      <h2 className="text-block-title text-fg">Apports au compte de tiers</h2>
      {deposits.isError ? <LoadError title={deposits.error?.message ?? 'Les apports n’ont pas pu être chargés'} /> : null}
      {deposits.isPending && !deposits.isError ? <ListLoading label="Chargement des apports" /> : null}
      {deposits.data && rows.length === 0 ? <EmptyState icon={Landmark} title="Aucun apport" description="Un apport est demandé puis confirmé par un second approbateur." /> : null}
      {rows.length > 0 ? (
        <Table aria-label="Apports au compte de tiers">
          <TableHead>
            <TableRow>
              <TableHeaderCell>Date du virement</TableHeaderCell>
              <TableHeaderCell numeric>Montant</TableHeaderCell>
              <TableHeaderCell>Référence</TableHeaderCell>
              <TableHeaderCell>État</TableHeaderCell>
              <TableHeaderCell>Contrôle</TableHeaderCell>
              {permissions.sensitive ? <TableHeaderCell><span className="sr-only">Action</span></TableHeaderCell> : null}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((deposit) => (
              <TableRow key={deposit.id}>
                <TableCell>{formatDateFr(deposit.executedOn)}</TableCell>
                <TableCell numeric>{moneyText(deposit.amount)}</TableCell>
                <TableCell>{deposit.bankReference}</TableCell>
                <TableCell><Badge tone={depositBadge[deposit.status].tone}>{depositBadge[deposit.status].label}</Badge></TableCell>
                <TableCell>{deposit.secondApproverRequired ? 'Second approbateur requis' : 'Un seul approbateur'}{deposit.confirmedSolo ? ' · confirmé sans second approbateur' : ''}</TableCell>
                {permissions.sensitive ? (
                  <TableCell>
                    {deposit.status === 'pending' ? (
                      <Button variant="ghost" size="sm" onClick={() => { setConfirming(deposit); }}>
                        Confirmer{' '}<span className="sr-only">{`l’apport de ${moneyText(deposit.amount)}`}</span>
                      </Button>
                    ) : null}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
      <CursorPager pages={pages} nextCursor={deposits.data?.nextCursor ?? null} label="Pagination des apports" />
      <ConfirmAction
        open={confirming !== null}
        title="Confirmer cet apport ?"
        description={confirming ? `L’apport de ${moneyText(confirming.amount)} (référence ${confirming.bankReference}) est écrit au grand livre. ${confirming.secondApproverRequired ? 'Il doit être confirmé par une autre personne que celle qui l’a demandé.' : 'Un seul approbateur suffit : l’équipe habilitée est réduite à un membre.'}` : ''}
        confirmLabel="Confirmer l’apport"
        failureTitle="Apport non confirmé"
        onClose={() => { setConfirming(null); }}
        run={async () => {
          if (!confirming) return;
          await confirm.mutateAsync({ depositId: confirming.id, key: keyFor(confirming.id) });
          notify({ title: 'Apport confirmé', description: 'Le compte de tiers est crédité au grand livre.' });
        }}
      />
    </Card>
  );
}
