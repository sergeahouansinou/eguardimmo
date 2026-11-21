'use client';

import { Badge, Button, Icon } from '@eguardimmo/ui';
import { Ban, CheckCircle2, FileDown, Paperclip } from 'lucide-react';
import { useState } from 'react';
import { useApproveExpense, useAttachExpenseFile, useCancelExpense, useChargesPermissions, useExpense, useUnitChoices } from './hooks';
import { expenseStatusBadge, kindLabel, moneyText, settlementLabel } from './labels';
import type { Expense } from './model';
import { ChargesGate } from './parts/ChargesGate';
import { ActionError } from './parts/ActionError';
import { ConfirmAction } from './parts/ConfirmAction';
import { DownloadButton } from './parts/DownloadButton';
import { ReasonDialog } from './parts/ReasonDialog';
import { usePropertyLabels, useRubricLabels, useTermLabels } from './parts/choices';
import { runWithProof } from './parts/proof';
import { QueryState } from './parts/states';
import { chargesPaths } from './paths';
import { canApprove } from './permissions';
import { FILE_MIMES, MAX_FILE_BYTES } from './schemas';
import { useChargesSource } from './source';
import { DescriptionList, FilePicker, LinkButton, PageHeader, SectionCard, useNotify } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';
import { useTwoFactorProof } from '../../reauth';

export function ExpenseDetailPage({ id }: { id: string }) {
  return (
    <ChargesGate>
      <ExpenseDetailContent id={id} />
    </ChargesGate>
  );
}

function ExpenseDetailContent({ id }: { id: string }) {
  const expense = useExpense(id);
  return (
    <>
      {expense.data ? (
        <ExpenseDetail expense={expense.data} />
      ) : (
        <>
          <PageHeader crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Dépenses', href: chargesPaths.expenses }, { label: 'Dépense' }]} title="Dépense" />
          <QueryState
            query={expense}
            label="Chargement de la dépense"
            title="Impossible de charger la dépense"
            notFound={{ title: 'Dépense introuvable', description: 'Cette dépense n’existe pas dans votre organisation.', backHref: chargesPaths.expenses, backLabel: 'Retour aux dépenses' }}
          />
        </>
      )}
    </>
  );
}

function ExpenseDetail({ expense }: { expense: Expense }) {
  const permissions = useChargesPermissions();
  const source = useChargesSource();
  const notify = useNotify();
  const proof = useTwoFactorProof(source.confirmTwoFactor);
  const approve = useApproveExpense();
  const cancel = useCancelExpense();
  const [confirming, setConfirming] = useState<'approve' | 'cancel' | null>(null);
  const badge = expenseStatusBadge[expense.status];
  const title = expense.payeeLabel ?? expense.reference ?? 'Dépense';

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Dépenses', href: chargesPaths.expenses }, { label: title }]}
        title={title}
        badges={<Badge tone={badge.tone}>{badge.label}</Badge>}
        subtitle={kindLabel[expense.kind]}
        actions={
          <>
            {expense.status === 'pending_approval' && canApprove(permissions) ? (
              <Button variant="primary" onClick={() => { setConfirming('approve'); }}>
                <Icon icon={CheckCircle2} />
                Valider la dépense
              </Button>
            ) : null}
            {expense.status !== 'cancelled' && permissions.write ? (
              <Button variant="secondary" onClick={() => { setConfirming('cancel'); }}>
                <Icon icon={Ban} />
                Annuler la dépense
              </Button>
            ) : null}
            <LinkButton href={chargesPaths.expenses} variant="ghost">Retour à la liste</LinkButton>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ExpenseFacts expense={expense} />
        <ExpenseFiles expense={expense} />
      </div>
      <ConfirmAction
        open={confirming === 'approve'}
        title="Valider cette dépense ?"
        description={`Vous validez ${moneyText(expense.totalGross)} engagés sur les fonds du mandant. Le même membre ne peut pas à la fois saisir et valider.`}
        confirmLabel="Valider la dépense"
        failureTitle="Dépense non validée"
        run={async () => {
          await runWithProof(proof, () => approve.mutateAsync(expense.id));
          notify({ title: 'Dépense validée', description: 'L’écriture comptable a été passée.' });
        }}
        onClose={() => { setConfirming(null); }}
      />
      <ReasonDialog
        open={confirming === 'cancel'}
        title="Annuler cette dépense"
        description="L’annulation est tracée et ne supprime rien. Une dépense déjà retenue dans un exercice ne peut pas être annulée."
        confirmLabel="Annuler la dépense"
        failureTitle="Dépense non annulée"
        placeholder="ex. Facture saisie en double"
        run={async (reason) => {
          await runWithProof(proof, () => cancel.mutateAsync({ id: expense.id, reason }));
          notify({ title: 'Dépense annulée', description: 'Elle n’entre plus dans la régularisation des charges.' });
        }}
        onClose={() => { setConfirming(null); }}
      />
      {proof.dialog}
    </>
  );
}

function ExpenseFacts({ expense }: { expense: Expense }) {
  const properties = usePropertyLabels();
  const categories = useTermLabels('expense_category');
  const rubrics = useRubricLabels();
  const units = useUnitChoices(expense.unitId === null ? null : expense.propertyId);
  const unit = expense.unitId === null ? 'Tout l’immeuble' : (units.data?.find((candidate) => candidate.id === expense.unitId)?.reference ?? 'Lot');

  return (
    <SectionCard id="expense-detail" title="Détail de la dépense">
      <DescriptionList
        termWidth="150px"
        items={[
          { term: 'Bien', detail: properties.nameOf(expense.propertyId) },
          { term: 'Lot', detail: unit },
          { term: 'Catégorie', detail: categories.labelOf(expense.categoryTermId) },
          { term: 'Référence', detail: expense.reference ?? '—' },
          { term: 'Date de la pièce', detail: formatDateFr(expense.documentOn) },
          { term: 'Service rendu', detail: `du ${formatDateFr(expense.serviceFrom)} au ${formatDateFr(expense.serviceTo)} (exclu)` },
          { term: 'Montant TTC', detail: moneyText(expense.totalGross) },
          { term: 'dont TVA', detail: moneyText(expense.taxAmount) },
          { term: 'Part récupérable', detail: `${moneyText(expense.recoverableAmount)}${expense.recoverableRubric === null ? '' : ` — ${rubrics.labelOf(expense.recoverableRubric)}`}` },
          { term: 'Règlement', detail: settlementLabel[expense.settlement] },
          { term: 'Payée le', detail: formatDateFr(expense.paidOn) },
          { term: 'Écriture comptable', detail: expense.posted ? 'Passée au grand livre' : 'Aucune écriture' },
          ...(expense.cancelReason === null ? [] : [{ term: 'Motif d’annulation', detail: expense.cancelReason }]),
        ]}
      />
    </SectionCard>
  );
}

function ExpenseFiles({ expense }: { expense: Expense }) {
  const permissions = useChargesPermissions();
  const source = useChargesSource();
  const attach = useAttachExpenseFile();
  const [file, setFile] = useState<File | null>(null);
  const notify = useNotify();

  return (
    <SectionCard id="expense-files" title="Pièces justificatives">
      {expense.files.length === 0 ? <p className="text-body text-fg-subtle">Aucune pièce jointe.</p> : null}
      <ul className="flex flex-col gap-2">
        {expense.files.map((fileId, index) => (
          <li key={fileId} className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-body text-fg"><Icon icon={Paperclip} />{`Pièce ${String(index + 1)}`}</span>
            <DownloadButton size="sm" load={() => source.downloadExpenseFile(expense.id, fileId)} filename={`depense-${expense.id}-piece-${String(index + 1)}`} failureTitle="Téléchargement impossible">
              <Icon icon={FileDown} />
              Télécharger
            </DownloadButton>
          </li>
        ))}
      </ul>
      {permissions.write && expense.status !== 'cancelled' ? (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <FilePicker
            label="Ajouter une pièce"
            hint="PDF, JPG ou PNG, 10 Mo au maximum."
            accept={FILE_MIMES.join(',')}
            file={file}
            onFile={setFile}
            validate={(candidate) => {
              if (candidate.size > MAX_FILE_BYTES) return 'La pièce dépasse 10 Mo.';
              return FILE_MIMES.some((mime) => mime === candidate.type) ? null : 'La pièce doit être un PDF, un JPG ou un PNG.';
            }}
          />
          {attach.isError ? <ActionError title="Pièce non ajoutée" error={attach.error} /> : null}
          <div className="flex justify-end">
            <Button
              variant="secondary"
              disabled={file === null}
              loading={attach.isPending}
              onClick={() => {
                if (file === null) return;
                attach.mutate({ id: expense.id, file }, { onSuccess: () => { setFile(null); notify({ title: 'Pièce ajoutée', description: 'Elle est rattachée à la dépense.' }); } });
              }}
            >
              Ajouter la pièce
            </Button>
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}
