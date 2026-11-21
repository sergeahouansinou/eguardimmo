"use client";

import { Alert, Button, Textarea } from "@eguardimmo/ui";
import { useState } from "react";
import { DataList } from "@/features/confie/ui/DataList";
import { describeFailure } from "../errors";
import { ActionFailure } from "../security/ActionFailure";
import { NOT_AVAILABLE, formatDateTime, formatDay, formatOptionalMoney } from "../format";
import { ActionDialog, useReturnFocus } from "../shared/ActionDialog";
import { newIntentKey } from "../shared/idempotency";
import { useWriteAccess } from "../shared/useWriteAccess";
import type { ApprovalDecision, ApprovalOutcome, InterventionApproval, InterventionQuote, OwnerInterventionDetail } from "./model";
import { useDecideApproval } from "./queries";
import { COMMENT_MAX, COMMENT_MIN, DECISION_COPY, REPLAYED_MESSAGE, statementOf } from "./statements";

export interface DecisionNotice {
  tone: "success" | "warning";
  title: string;
  text: string;
}

export type NoticeHandler = (notice: DecisionNotice) => void;

interface DialogProps {
  intervention: OwnerInterventionDetail;
  approval: InterventionApproval;
  quote: InterventionQuote | undefined;
  decision: ApprovalDecision;
  statement: string;
  onClose: () => void;
  onNotice: NoticeHandler;
  onCloseAutoFocus: (event: Event) => void;
}

function validate(decision: ApprovalDecision, comment: string): string | null {
  const copy = DECISION_COPY[decision];
  if (comment.length > COMMENT_MAX) return `Le commentaire ne peut pas dépasser ${String(COMMENT_MAX)} caractères.`;
  if (copy.commentRequired && comment.length < COMMENT_MIN) return `Ce champ est obligatoire : ${String(COMMENT_MIN)} caractères au moins.`;
  return null;
}

function DecisionDialog({ intervention, approval, quote, decision, statement, onClose, onNotice, onCloseAutoFocus }: DialogProps) {
  const copy = DECISION_COPY[decision];
  const [intentKey] = useState(newIntentKey);
  const mutation = useDecideApproval(intentKey);
  const [comment, setComment] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const submit = () => {
    const trimmed = comment.trim();
    const invalid = validate(decision, trimmed);
    setProblem(invalid);
    if (invalid !== null) return;
    mutation.mutate(
      { interventionId: intervention.id, approval, decision, comment: trimmed === "" ? null : trimmed },
      {
        onSuccess: (outcome) => {
          onNotice({ tone: "success", title: "Décision enregistrée", text: decidedMessage(decision, outcome) });
          onClose();
        },
        onError: (error) => {
          const failure = describeFailure(error);
          if (failure.kind !== "stale" && failure.kind !== "conflict") return;
          onNotice({ tone: "warning", title: "Décision non enregistrée", text: failure.message });
          onClose();
        },
      },
    );
  };

  return (
    <ActionDialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
      title={copy.title}
      description={`${intervention.reference} · ${intervention.title}`}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <DataList
        width="lg"
        items={[
          { label: "Devis", value: quote?.reference ?? "Devis soumis" },
          { label: "Prestataire", value: intervention.supplierName ?? NOT_AVAILABLE },
          { label: "Montant", value: formatOptionalMoney(approval.amount) },
          { label: "À décider avant", value: formatDateTime(approval.decideBefore) },
        ]}
      />
      <Textarea
        label={copy.commentLabel}
        placeholder={copy.commentPlaceholder}
        value={comment}
        maxLength={COMMENT_MAX}
        error={problem ?? undefined}
        data-autofocus
        onChange={(event) => {
          setComment(event.target.value);
        }}
      />
      <p className="rounded-md border border-line bg-muted px-3 py-2 text-caption text-fg-muted">{statement}</p>
      {mutation.isError ? <ActionFailure error={mutation.error} title="Votre décision n’a pas été enregistrée" retryable /> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" disabled={mutation.isPending} onClick={onClose}>
          Annuler
        </Button>
        <Button variant={decision === "refuse" ? "danger" : "primary"} loading={mutation.isPending} onClick={submit}>
          {copy.confirm}
        </Button>
      </div>
    </ActionDialog>
  );
}

const DECISIONS_BY_STATUS: Readonly<Record<string, readonly ApprovalDecision[]>> = {
  pending: ["accept", "refuse", "question"],
  question: ["accept", "refuse"],
};

export function approvalDecisions(status: string): readonly ApprovalDecision[] {
  return DECISIONS_BY_STATUS[status] ?? [];
}

export function ApprovalActions({ intervention, approval, onNotice }: { intervention: OwnerInterventionDetail; approval: InterventionApproval; onNotice: NoticeHandler }) {
  const access = useWriteAccess(intervention.agency.id);
  const [decision, setDecision] = useState<ApprovalDecision | null>(null);
  const focus = useReturnFocus();
  const decisions = approvalDecisions(approval.status);
  const statement = statementOf(approval.statementVersion);
  if (decisions.length === 0) return null;

  if (!access.canWrite) {
    return (
      <p className="text-caption text-fg-subtle">
        {access.inGrace
          ? `Votre mandat est terminé${access.graceUntil === null ? "" : ` : lecture seule jusqu’au ${formatDay(access.graceUntil)}`}. Vous ne pouvez plus décider depuis votre espace.`
          : "Seul le titulaire du mandat ou son représentant peut décider ; l’agence peut aussi enregistrer la décision."}
      </p>
    );
  }
  if (statement === null) {
    return (
      <Alert tone="warning" title="Décision indisponible depuis cette page">
        Cette demande ne peut pas être décidée depuis cette version de l’espace. Rechargez la page ou contactez votre agence.
      </Alert>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {decisions.map((value) => (
        <Button
          key={value}
          variant={DECISION_COPY[value].variant}
          size="sm"
          onClick={(event) => {
            focus.remember(event.currentTarget);
            setDecision(value);
          }}
        >
          {DECISION_COPY[value].open}
        </Button>
      ))}
      {decision === null ? null : (
        <DecisionDialog
          key={decision}
          intervention={intervention}
          approval={approval}
          quote={intervention.quotes.find((candidate) => candidate.id === approval.quoteId)}
          decision={decision}
          statement={statement}
          onClose={() => {
            setDecision(null);
          }}
          onNotice={onNotice}
          onCloseAutoFocus={focus.onCloseAutoFocus}
        />
      )}
    </div>
  );
}

export function decidedMessage(decision: ApprovalDecision, outcome: ApprovalOutcome): string {
  return outcome.replayed ? REPLAYED_MESSAGE : DECISION_COPY[decision].done;
}
