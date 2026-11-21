"use client";

import { Alert, Badge, Button } from "@eguardimmo/ui";
import { useState } from "react";
import { DataList } from "@/features/confie/ui/DataList";
import { Section } from "@/features/confie/ui/Section";
import { formatDateTime, formatDay } from "../format";
import { ConfirmAction } from "../shared/ConfirmAction";
import { useReturnFocus } from "../shared/ActionDialog";
import { CodeForm } from "./CodeForm";
import { LIVE_STATUSES, REQUEST_STATUS } from "./labels";
import type { PayoutAccount } from "./model";
import { useContestPayoutAccount, useWithdrawPayoutRequest } from "./queries";
import { RequestDialog } from "./RequestDialog";

export interface PayoutNotice {
  title: string;
  text: string;
}

type Action = "request" | "withdraw" | "contest";

function RequestBlock({ account, onNotice }: { account: PayoutAccount; onNotice: (notice: PayoutNotice) => void }) {
  const request = account.request;
  const [withdrawing, setWithdrawing] = useState(false);
  const focus = useReturnFocus();
  const withdraw = useWithdrawPayoutRequest(request?.id ?? "");
  if (request === null) return null;
  const entry = REQUEST_STATUS[request.status];
  const live = LIVE_STATUSES.includes(request.status);
  return (
    <div className="flex flex-col gap-2 rounded-md border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-body font-semibold">Dernière demande de changement</h3>
        <Badge tone={entry?.tone ?? "neutral"}>{entry?.label ?? request.status}</Badge>
      </div>
      <DataList
        width="lg"
        items={[
          { label: "Nouveau compte", value: request.bankLast4 === null ? "Non communiqué" : `•••• ${request.bankLast4}` },
          { label: "Titulaire", value: request.holderName ?? "Non communiqué" },
          { label: "Demandée le", value: request.requestedAt === null ? "Non communiqué" : formatDateTime(request.requestedAt) },
          ...(request.decidedAt === null ? [] : [{ label: "Traitée le", value: formatDateTime(request.decidedAt) }]),
        ]}
      />
      <p className="text-caption text-fg-muted">{entry?.detail ?? "Cette demande n’est plus en cours."}</p>
      {request.status === "awaiting_code" && account.canRequest ? <CodeForm request={request} onConfirmed={() => { onNotice({ title: "Code confirmé", text: "Votre demande est transmise à l’agence. Le compte actuel reste utilisé jusqu’à son approbation." }); }} /> : null}
      {live && account.canRequest ? (
        <div>
          <Button
            variant="secondary"
            size="sm"
            onClick={(event) => {
              focus.remember(event.currentTarget);
              setWithdrawing(true);
            }}
          >
            Retirer la demande
          </Button>
        </div>
      ) : null}
      <ConfirmAction
        open={withdrawing}
        onOpenChange={setWithdrawing}
        title="Retirer la demande de changement de compte ?"
        description="Le compte de paiement actuel est conservé. Vous pourrez déposer une nouvelle demande."
        confirmLabel="Retirer la demande"
        pending={withdraw.isPending}
        error={withdraw.isError ? withdraw.error : null}
        failureTitle="La demande n’a pas été retirée"
        onCloseAutoFocus={focus.onCloseAutoFocus}
        onConfirm={() => {
          withdraw.mutate(undefined, {
            onSuccess: () => {
              setWithdrawing(false);
              onNotice({ title: "Demande retirée", text: "Votre compte de paiement actuel est conservé." });
            },
          });
        }}
      />
    </div>
  );
}

export function AccountCard({ account, onNotice }: { account: PayoutAccount; onNotice: (notice: PayoutNotice) => void }) {
  const [action, setAction] = useState<Action | null>(null);
  const focus = useReturnFocus();
  const contest = useContestPayoutAccount(account.accessId);
  const hasLive = account.request !== null && LIVE_STATUSES.includes(account.request.status);
  const open = (next: Action) => (event: { currentTarget: HTMLElement }) => {
    focus.remember(event.currentTarget);
    setAction(next);
  };
  return (
    <Section title={`${account.agencyName ?? "Votre agence"} · ${account.mandantName}`}>
      <div className="flex flex-col gap-3">
        <DataList
          width="lg"
          items={[
            { label: "Compte actuel", value: account.current === null ? "Aucun compte de paiement enregistré" : `•••• ${account.current.bankLast4}` },
            ...(account.current === null ? [] : [{ label: "Actif depuis le", value: formatDay(account.current.activeSince) }]),
          ]}
        />
        {account.coolingUntil === null ? null : (
          <Alert tone="info" title="Compte récemment modifié">
            Par sécurité, les reversements vers ce compte sont différés jusqu’au {formatDay(account.coolingUntil)}.
          </Alert>
        )}
        {account.contested ? (
          <Alert tone="warning" title="Signalement en cours d’examen">
            Vous avez signalé un changement de compte que vous n’avez pas demandé. Les reversements de ce mandant sont mis en attente tant que votre agence n’a pas terminé son examen.
          </Alert>
        ) : null}
        <RequestBlock account={account} onNotice={onNotice} />
        {account.canRequest ? (
          <div className="flex flex-wrap gap-2">
            {hasLive ? null : <Button onClick={open("request")}>Demander un changement de compte</Button>}
            {account.current !== null && !account.contested ? (
              <Button variant="secondary" onClick={open("contest")}>
                Ce n’est pas moi
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-caption text-fg-subtle">Seul le titulaire du mandat ou son représentant peut demander un changement de compte ; cet accès est en lecture seule.</p>
        )}
      </div>
      {action === "request" ? (
        <RequestDialog
          account={account}
          onClose={() => {
            setAction(null);
          }}
          onDone={() => {
            setAction(null);
            onNotice({ title: "Demande enregistrée", text: "Un code de confirmation vous a été envoyé par e-mail. Saisissez-le ci-dessous pour transmettre la demande à votre agence." });
          }}
          onCloseAutoFocus={focus.onCloseAutoFocus}
        />
      ) : null}
      <ConfirmAction
        open={action === "contest"}
        onOpenChange={(next) => {
          if (!next) setAction(null);
        }}
        title="Signaler un changement que vous n’avez pas demandé ?"
        description="Les reversements de ce mandant seront mis en attente, la demande en cours sera abandonnée et votre agence sera alertée pour vérifier le compte. Utilisez cette action seulement si vous ne reconnaissez pas ce changement."
        confirmLabel="Oui, ce n’est pas moi"
        tone="danger"
        pending={contest.isPending}
        error={contest.isError ? contest.error : null}
        failureTitle="Le signalement n’a pas été enregistré"
        onCloseAutoFocus={focus.onCloseAutoFocus}
        onConfirm={() => {
          contest.mutate(undefined, {
            onSuccess: () => {
              setAction(null);
              onNotice({ title: "Signalement enregistré", text: "Votre agence est alertée. Les reversements de ce mandant sont mis en attente le temps de l’examen." });
            },
          });
        }}
      />
    </Section>
  );
}
