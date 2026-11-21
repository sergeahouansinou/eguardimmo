'use client';

import { Alert, Badge, Button, Card, Icon } from '@eguardimmo/ui';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { BatchItemsTable } from './BatchItemsTable';
import type { ItemAction } from './BatchItemsTable';
import { ExecuteDialog } from './ExecuteDialog';
import type { ExecuteTarget } from './ExecuteDialog';
import { OwnerFundsApiError } from './api/ownerFundsErrors';
import { useAttemptKey } from './attemptKey';
import { useBatch, useCancelBatch, useExportBatch, useFailItem, useOwnerFundsPermissions, usePartyNames, useReturnItem, useToggleItem, useValidateBatch } from './hooks';
import { batchBadge, plural } from './labels';
import type { PayoutBatch, PayoutItem } from './model';
import { ownerFundsPaths } from './paths';
import { ActionError, ConfirmAction, OwnerFundsGate, OwnerFundsSections, ReasonDialog, RoleNotice } from './parts';
import { saveBlob } from '../rent/download';
import { ListLoading, LoadError, NotFoundPanel, PageHeader, useGestionNavigation, useNotify } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function BatchPage() {
  const { search } = useGestionNavigation();
  const id = search.get('lot');
  return (
    <OwnerFundsGate>
      {id !== null && GUID.test(id) ? (
        <BatchContent id={id} />
      ) : (
        <NotFoundPanel title="Lot introuvable" description="Ouvrez un lot depuis la liste des reversements." backHref={ownerFundsPaths.payouts} backLabel="Retour aux reversements" />
      )}
    </OwnerFundsGate>
  );
}

type DialogState = { kind: 'validate' } | { kind: 'cancel' } | { kind: 'execute'; item: PayoutItem } | { kind: 'fail'; item: PayoutItem } | { kind: 'return'; item: PayoutItem } | null;

function BatchContent({ id }: { id: string }) {
  const permissions = useOwnerFundsPermissions();
  const batchQuery = useBatch(id);
  const batch = batchQuery.data;
  const names = usePartyNames(batch?.items?.map((item) => item.mandantId) ?? []);
  const toggle = useToggleItem();
  const validate = useValidateBatch();
  const cancel = useCancelBatch();
  const fail = useFailItem();
  const giveBack = useReturnItem();
  const exportCsv = useExportBatch();
  const keyFor = useAttemptKey();
  const notify = useNotify();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const close = () => { setDialog(null); };

  if (batchQuery.isError) {
    const missing = batchQuery.error instanceof OwnerFundsApiError && batchQuery.error.kind === 'not_found';
    if (missing) return <NotFoundPanel title="Lot introuvable" description="Ce lot n’existe pas dans votre organisation." backHref={ownerFundsPaths.payouts} backLabel="Retour aux reversements" />;
    return <LoadError title={batchQuery.error?.message ?? 'Le lot n’a pas pu être chargé'} />;
  }
  if (!batch) return <ListLoading label="Chargement du lot" />;

  const included = (batch.items ?? []).filter((item) => item.status === 'included').length;

  const onAction = (action: ItemAction, item: PayoutItem) => {
    if (action === 'include' || action === 'exclude') {
      setFailure(null);
      toggle
        .mutateAsync({ batchId: batch.id, itemId: item.id, lockVersion: batch.lockVersion, include: action === 'include', key: keyFor(`${action}:${item.id}:${String(batch.lockVersion)}`) })
        .catch((error: unknown) => { setFailure(error); });
      return;
    }
    setDialog({ kind: action, item });
  };

  const download = async () => {
    setFailure(null);
    try {
      saveBlob(await exportCsv.mutateAsync(batch.id), `${(batch.number ?? 'lot').replace(/[^A-Za-z0-9._-]+/g, '-')}.csv`);
    } catch (error) {
      setFailure(error);
    }
  };

  const executeTarget: ExecuteTarget | null = dialog?.kind === 'execute' ? { batch, item: dialog.item, name: names(dialog.item.mandantId) } : null;
  const target = dialog && 'item' in dialog ? dialog.item : null;
  const targetName = target ? names(target.mandantId) : '';

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Reversements', href: ownerFundsPaths.payouts }, { label: batch.number ?? 'Lot en préparation' }]}
        title={batch.number ?? 'Lot en préparation'}
        subtitle={batch.validatedAt ? `Validé le ${formatDateFr(batch.validatedAt)}.` : 'Brouillon : le serveur relit chaque compte à la validation.'}
        badges={<Badge tone={batchBadge[batch.status].tone}>{batchBadge[batch.status].label}</Badge>}
        actions={<BatchActions batch={batch} onValidate={() => { setDialog({ kind: 'validate' }); }} onCancel={() => { setDialog({ kind: 'cancel' }); }} onExport={() => { void download(); }} exporting={exportCsv.isPending} />}
      />
      <OwnerFundsSections current="payouts" />
      {batch.secondApproverRequired && batch.status === 'validated' ? (
        <Alert tone="info" title="Second approbateur requis">Chaque virement doit être exécuté par une autre personne que celle qui a validé ce lot.</Alert>
      ) : null}
      {batch.status === 'cancelled' && batch.cancelReason ? <Alert tone="warning" title="Lot annulé">{batch.cancelReason}</Alert> : null}
      {failure === null ? null : <ActionError title="Action non effectuée" error={failure} />}
      <Card role="region" aria-label="Mandants du lot" className="gap-3">
        <h2 className="text-block-title text-fg">{`Mandants du lot (${String(batch.items?.length ?? 0)})`}</h2>
        <BatchItemsTable batch={batch} names={names} onAction={onAction} />
        {!permissions.sensitive ? <RoleNotice>La validation, l’exécution des virements, l’annulation et l’export sont réservés au propriétaire, à l’administrateur et au comptable, avec double authentification.</RoleNotice> : null}
      </Card>

      <ConfirmAction
        open={dialog?.kind === 'validate'}
        title="Valider ce lot ?"
        description={`${plural(included, 'mandant inclus', 'mandants inclus')} : le serveur relit chaque compte, émet les factures d’honoraires dues, recalcule le net et écarte avec son motif tout mandant dont la situation a changé.`}
        confirmLabel="Valider le lot"
        failureTitle="Lot non validé"
        onClose={close}
        run={async () => {
          const done = await validate.mutateAsync({ batchId: batch.id, lockVersion: batch.lockVersion, key: keyFor(`validate:${batch.id}:${String(batch.lockVersion)}`) });
          const stopped = (done.items ?? []).filter((item) => item.status === 'excluded').length;
          notify({ title: 'Lot validé', description: stopped > 0 ? `${plural(stopped, 'mandant écarté', 'mandants écartés')} : consultez le motif dans la liste.` : `Numéro ${done.number ?? ''}.` });
        }}
      />
      <ReasonDialog
        open={dialog?.kind === 'cancel'}
        title="Annuler ce lot ?"
        description="Les virements en attente sont contrepassés. Un lot dont un virement est exécuté ne s’annule pas."
        confirmLabel="Annuler le lot"
        failureTitle="Lot non annulé"
        onClose={close}
        run={async (reason) => {
          await cancel.mutateAsync({ batchId: batch.id, reason, lockVersion: batch.lockVersion, key: keyFor(`cancel:${batch.id}:${String(batch.lockVersion)}:${reason}`) });
          notify({ title: 'Lot annulé', description: 'Les virements en attente ont été contrepassés.' });
        }}
      />
      <ExecuteDialog target={executeTarget} onClose={close} />
      <ReasonDialog
        open={dialog?.kind === 'fail'}
        title="Signaler l’échec du virement ?"
        description={`Le virement vers ${targetName} est refusé avant exécution : la validation est contrepassée et le mandant retrouve son solde.`}
        confirmLabel="Signaler l’échec"
        failureTitle="Échec non enregistré"
        onClose={close}
        run={async (reason) => {
          if (!target) return;
          await fail.mutateAsync({ batchId: batch.id, itemId: target.id, reason, key: keyFor(`fail:${target.id}:${reason}`) });
          notify({ title: 'Échec enregistré', description: `${targetName} : le montant redevient payable.` });
        }}
      />
      <ReasonDialog
        open={dialog?.kind === 'return'}
        title="Déclarer un retour bancaire ?"
        description={`Le virement exécuté vers ${targetName} est revenu : l’exécution puis la validation sont contrepassées.`}
        confirmLabel="Déclarer le retour"
        failureTitle="Retour non enregistré"
        onClose={close}
        run={async (reason) => {
          if (!target) return;
          await giveBack.mutateAsync({ batchId: batch.id, itemId: target.id, reason, key: keyFor(`return:${target.id}:${reason}`) });
          notify({ title: 'Retour enregistré', description: `${targetName} : le montant redevient payable.` });
        }}
      />
    </>
  );
}

function BatchActions({ batch, onValidate, onCancel, onExport, exporting }: { batch: PayoutBatch; onValidate: () => void; onCancel: () => void; onExport: () => void; exporting: boolean }) {
  const permissions = useOwnerFundsPermissions();
  const live = batch.status === 'draft' || batch.status === 'validated';
  const exportable = batch.status === 'validated' || batch.status === 'executed';
  return (
    <>
      {permissions.export && exportable ? (
        <Button variant="secondary" loading={exporting} onClick={onExport}>
          <Icon icon={Download} />
          Exporter en CSV
        </Button>
      ) : null}
      {permissions.sensitive && live ? <Button variant="secondary" onClick={onCancel}>Annuler le lot</Button> : null}
      {permissions.sensitive && batch.status === 'draft' ? <Button onClick={onValidate}>Valider le lot</Button> : null}
    </>
  );
}
