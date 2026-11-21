'use client';

import { Alert, Badge, Button, Dialog, DialogClose, DialogContent } from '@eguardimmo/ui';
import Link from 'next/link';
import { useState } from 'react';
import { formatDateTime } from '@/lib/format';
import { APPROVAL_ACTION_LABELS, APPROVAL_STATUS_LABELS, APPROVAL_STATUS_TONES, labelOf } from '@/platform/labels';
import type { Approval } from '@/platform/approvals/approvals';
import { ApprovalDecisionDialog } from './ApprovalDecisionDialog';
import type { Decision } from './ApprovalDecisionDialog';
import { failureMessage, isOwnPending, payloadKeyLabel, payloadValueLabel, subjectLink, subjectTypeLabel } from './approvalView';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="text-caption text-fg-subtle sm:w-40 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export interface ApprovalDetailDialogProps {
  approval: Approval | null;
  operatorId: string | undefined;
  onClose: () => void;
}

export function ApprovalDetailDialog({ approval, operatorId, onClose }: ApprovalDetailDialogProps) {
  const [decision, setDecision] = useState<Decision | null>(null);
  const link = approval ? subjectLink(approval) : null;
  const failure = approval ? failureMessage(approval.failureCode) : null;
  return (
    <>
      <Dialog open={approval !== null && decision === null} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent title={approval ? labelOf(APPROVAL_ACTION_LABELS, approval.action) : 'Demande'} description="Demande soumise à la validation d’un second opérateur.">
          {approval ? (
            <div className="flex flex-col gap-3 px-4 pt-3 pb-4">
              <div>
                <Badge tone={APPROVAL_STATUS_TONES[approval.status]}>{APPROVAL_STATUS_LABELS[approval.status]}</Badge>
              </div>
              {isOwnPending(approval, operatorId) ? (
                <Alert tone="info">Vous avez déposé cette demande : un second opérateur doit la traiter.</Alert>
              ) : null}
              {failure ? <Alert tone="danger">{failure}</Alert> : null}
              <dl className="flex flex-col gap-2 text-body">
                <Row label="Sujet">
                  {subjectTypeLabel(approval.subjectType)}
                  {link ? (
                    <>
                      {' · '}
                      <Link href={link.href} className="underline">
                        {link.label}
                      </Link>
                    </>
                  ) : null}
                </Row>
                <Row label="Motif">{approval.reason}</Row>
                {approval.ticketReference ? <Row label="Référence de ticket">{approval.ticketReference}</Row> : null}
                {approval.payload.map((entry) => (
                  <Row key={entry.key} label={payloadKeyLabel(entry.key)}>
                    {payloadValueLabel(entry.key, entry.value)}
                  </Row>
                ))}
                <Row label="Demandée par">
                  {approval.requestedBy.name ?? 'Opérateur'}, le {formatDateTime(approval.createdAt)}
                </Row>
                <Row label="Expire le">{formatDateTime(approval.expiresAt)}</Row>
                {approval.decidedBy ? (
                  <Row label="Traitée par">
                    {approval.decidedBy.name ?? 'Opérateur'}
                    {approval.decidedAt ? `, le ${formatDateTime(approval.decidedAt)}` : ''}
                  </Row>
                ) : null}
                {approval.executedAt ? <Row label="Exécutée le">{formatDateTime(approval.executedAt)}</Row> : null}
              </dl>
              <div className="flex flex-wrap justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="secondary">Fermer</Button>
                </DialogClose>
                {approval.canCancel ? (
                  <Button variant="secondary" onClick={() => { setDecision('cancel'); }}>
                    Annuler ma demande
                  </Button>
                ) : null}
                {approval.canDecide ? (
                  <>
                    <Button variant="secondary" onClick={() => { setDecision('reject'); }}>
                      Refuser
                    </Button>
                    <Button onClick={() => { setDecision('approve'); }}>Valider</Button>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <ApprovalDecisionDialog
        approval={approval}
        decision={decision}
        onClose={(done) => {
          setDecision(null);
          if (done) onClose();
        }}
      />
    </>
  );
}
