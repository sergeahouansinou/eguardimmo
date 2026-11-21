'use client';

import { Alert, Badge, Button, Card, Checkbox, EmptyState, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { Landmark } from 'lucide-react';
import { useState } from 'react';
import { BatchesCard } from './BatchesCard';
import { HoldsCard } from './HoldsCard';
import { PlaceHoldDialog } from './PlaceHoldDialog';
import type { HoldTarget } from './PlaceHoldDialog';
import { useAttemptKey } from './attemptKey';
import { useCreateBatch, useOwnerFundsPermissions, usePartyNames, usePayoutPreview } from './hooks';
import { exclusionLabel, moneyText, plural } from './labels';
import type { MandantAccount } from './model';
import { ownerFundsPaths } from './paths';
import { ActionError, OwnerFundsGate, OwnerFundsSections, RoleNotice } from './parts';
import { ListLoading, LoadError, PageHeader, noticeAfterNavigation, useGestionNavigation } from '../../locataires/kit';
import { links } from '../../locataires/kit/links';

const isReversible = (account: MandantAccount): boolean => account.exclusionReason === null && account.netPayable.amount > 0;

export function PayoutsPage() {
  return (
    <OwnerFundsGate>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Reversements' }]}
        title="Reversements"
        subtitle="Net reversable de chaque mandant, calculé par le serveur à partir du grand livre : honoraires et retenues déjà déduits."
      />
      <OwnerFundsSections current="payouts" />
      <PreviewCard />
      <BatchesCard />
      <HoldsCard />
    </OwnerFundsGate>
  );
}

function PreviewCard() {
  const { Link, push } = useGestionNavigation();
  const permissions = useOwnerFundsPermissions();
  const preview = usePayoutPreview();
  const create = useCreateBatch();
  const keyFor = useAttemptKey();
  const names = usePartyNames(preview.data?.accounts.map((account) => account.mandantId) ?? []);
  const [chosen, setChosen] = useState<ReadonlySet<string> | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [holdTarget, setHoldTarget] = useState<HoldTarget | null>(null);

  const accounts = preview.data?.accounts ?? [];
  const selected = chosen ?? new Set(accounts.filter(isReversible).map((account) => account.mandantId));
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChosen(next);
  };

  const prepare = async () => {
    const ids = accounts.filter((account) => selected.has(account.mandantId)).map((account) => account.mandantId);
    setFailure(null);
    try {
      const batch = await create.mutateAsync({ mandantIds: ids, key: keyFor(ids.join('|')) });
      noticeAfterNavigation({ title: 'Lot préparé', description: 'Vérifiez les mandants inclus puis validez le lot.' });
      push(ownerFundsPaths.batch(batch.id));
    } catch (error) {
      setFailure(error);
    }
  };

  return (
    <Card role="region" aria-label="Net à reverser" className="gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-block-title text-fg">Net à reverser</h2>
        {permissions.prepare ? (
          <Button size="sm" loading={create.isPending} disabled={selected.size === 0} onClick={() => { void prepare(); }}>
            {`Préparer un lot (${plural(selected.size, 'mandant', 'mandants')})`}
          </Button>
        ) : null}
      </div>
      {failure === null ? null : <ActionError title="Lot non préparé" error={failure} />}
      {preview.isError ? <LoadError title={preview.error?.message ?? 'L’aperçu des reversements n’a pas pu être chargé'} /> : null}
      {preview.isPending && !preview.isError ? <ListLoading label="Chargement de l’aperçu des reversements" /> : null}
      {preview.data && accounts.length === 0 ? (
        <EmptyState icon={Landmark} title="Aucun mandant à reverser" description="Aucun compte mandant n’a de solde payable pour le moment." />
      ) : null}
      {preview.data?.truncated ? (
        <Alert tone="info" title="Aperçu limité">{`Seuls les ${String(preview.data.limit)} comptes les plus élevés sont affichés.`}</Alert>
      ) : null}
      {accounts.length > 0 ? (
        <Table aria-label="Net à reverser par mandant">
          <TableHead>
            <TableRow>
              {permissions.prepare ? <TableHeaderCell><span className="sr-only">Inclure dans le lot</span></TableHeaderCell> : null}
              <TableHeaderCell>Mandant</TableHeaderCell>
              <TableHeaderCell numeric>Dû au mandant</TableHeaderCell>
              <TableHeaderCell numeric>Honoraires dus</TableHeaderCell>
              <TableHeaderCell numeric>Honoraires estimés</TableHeaderCell>
              <TableHeaderCell>Retenue</TableHeaderCell>
              <TableHeaderCell numeric>Net reversible</TableHeaderCell>
              <TableHeaderCell>Compte</TableHeaderCell>
              <TableHeaderCell>État</TableHeaderCell>
              {permissions.prepare ? <TableHeaderCell><span className="sr-only">Action</span></TableHeaderCell> : null}
            </TableRow>
          </TableHead>
          <TableBody>
            {accounts.map((account) => (
              <TableRow key={account.mandantId}>
                {permissions.prepare ? (
                  <TableCell>
                    <Checkbox label={`Inclure ${names(account.mandantId)} dans le lot`} hideLabel checked={selected.has(account.mandantId)} onChange={() => { toggle(account.mandantId); }} />
                  </TableCell>
                ) : null}
                <TableCell strong>
                  <Link href={ownerFundsPaths.mandant(account.mandantId)} className="text-action-on-subtle underline-offset-2 hover:underline">{names(account.mandantId)}</Link>
                </TableCell>
                <TableCell numeric>{moneyText(account.payable)}</TableCell>
                <TableCell numeric>{moneyText(account.feesDue)}</TableCell>
                <TableCell numeric>{moneyText(account.feesEstimated)}</TableCell>
                <TableCell>{account.fullHold ? 'Blocage total' : account.reserve.amount > 0 ? `Réserve ${moneyText(account.reserve)}` : '—'}</TableCell>
                <TableCell numeric className="font-medium text-fg">{moneyText(account.netPayable)}</TableCell>
                <TableCell>{account.bankLast4 === null ? 'Aucun compte' : `IBAN •••• ${account.bankLast4}`}</TableCell>
                <TableCell>
                  {account.exclusionReason === null ? <Badge tone="success">Reversible</Badge> : <Badge tone="warning">{exclusionLabel[account.exclusionReason]}</Badge>}
                </TableCell>
                {permissions.prepare ? (
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => { setHoldTarget({ mandantId: account.mandantId, name: names(account.mandantId), currency: account.netPayable.currency }); }}>
                      Retenue{' '}<span className="sr-only">{`sur ${names(account.mandantId)}`}</span>
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
      <PlaceHoldDialog target={holdTarget} onClose={() => { setHoldTarget(null); }} />
      {!permissions.prepare ? <RoleNotice>Votre rôle permet la lecture seule des reversements.</RoleNotice> : null}
    </Card>
  );
}
