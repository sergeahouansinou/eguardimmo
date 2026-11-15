"use client";

import { Badge, Button, Icon } from "@eguardimmo/ui";
import { CircleCheck, Circle, Bell, FileCheck, TriangleAlert, Download, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { ListRow } from "@/components/ui/ListRow";
import type { RowTone } from "@/components/ui/ListRow";
import { NotFoundState } from "@/components/ui/NotFoundState";
import { QueryState } from "@/components/ui/QueryState";
import { SectionCard } from "@/components/ui/SectionCard";
import { useDemoDownload } from "@/components/ui/useDemoDownload";
import { DetailList } from "@/features/kit/Details";
import { PageFrame } from "@/features/kit/PageFrame";
import { Timeline } from "@/features/kit/Timeline";
import { DEMO_TODAY, formatDate } from "@/features/shared/dates";
import { conditionView, joinList, pieceStatus, piecesToRenew, recommendedFilingStart, renewalThreshold } from "./logic";
import { CHANNEL_LABELS } from "./schemas";
import type { ConformiteData, Piece } from "./schemas";
import { ReminderDialog } from "./ReminderDialogs";
import { RenewDialog } from "./RenewDialog";
import { StatusBadge } from "./StatusBadge";
import { useConformite } from "./queries";

const TONE_ICONS = { success: CircleCheck, warning: TriangleAlert, danger: TriangleAlert, neutral: Circle } as const;

export function PieceDetailPage({ id }: { id: string }) {
  const query = useConformite();
  return (
    <QueryState query={query} label="La pièce">
      {(data) => {
        const piece = data.pieces.find((candidate) => candidate.id === id);
        return piece ? (
          <PieceDetail piece={piece} data={data} />
        ) : (
          <NotFoundState
            title="Pièce introuvable"
            description={`La pièce « ${id} » n’existe pas ou a été retirée du suivi.`}
            backHref="/conformite"
            backLabel="Retour à la conformité"
          />
        );
      }}
    </QueryState>
  );
}

function PieceDetail({ piece, data }: { piece: Piece; data: ConformiteData }) {
  const download = useDemoDownload();
  const [reminding, setReminding] = useState(false);
  const [renewing, setRenewing] = useState<Piece | null>(null);
  const threshold = renewalThreshold(data.reminders);
  const status = pieceStatus(piece, threshold);
  const toRenew = piecesToRenew(piece, data.pieces, threshold);
  const filingStart = recommendedFilingStart(piece.expiresOn);
  const filingOpen = filingStart <= DEMO_TODAY;

  const detailItems = [
    ...piece.details.map((detail) => ({
      label: detail.label,
      value: detail.field === "reference" ? piece.reference : detail.field === "expiresOn" ? formatDate(piece.expiresOn) : detail.value,
    })),
    { label: "Fichier", value: piece.fileName ?? "Aucun fichier déposé" },
    ...(piece.reminder ? [{ label: "Rappel", value: `${formatDate(piece.reminder.on)} · ${CHANNEL_LABELS[piece.reminder.channel]}` }] : []),
  ];

  const blocking = toRenew.filter((candidate) => candidate.id !== piece.id);

  return (
    <PageFrame
      crumbs={[{ label: "Conformité", href: "/conformite" }, { label: piece.title }]}
      title={piece.title}
      badges={<StatusBadge status={status} />}
      description={`${piece.subtitle} · valable jusqu’au ${formatDate(piece.expiresOn)}`}
      actions={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              setReminding(true);
            }}
          >
            <Icon icon={Bell} />
            Programmer un rappel
          </Button>
          <Button
            variant="secondary"
            disabled={piece.fileName === null}
            onClick={() => {
              download(piece.fileName ?? piece.title);
            }}
          >
            <Icon icon={Download} />
            Télécharger
          </Button>
        </>
      }
    >
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="flex min-w-0 flex-col gap-3">
          <SectionCard title={piece.conditions.length > 0 ? "Conditions du renouvellement" : "Conditions"}>
            {piece.conditions.length === 0 ? (
              <p className="text-body text-fg-muted">Aucune condition particulière n’est associée à cette pièce.</p>
            ) : (
              <div>
                {piece.conditions.map((condition) => {
                  const view = conditionView(condition, data.pieces, threshold, formatDate);
                  const tone: RowTone = view.tone;
                  return (
                    <ListRow
                      key={view.id}
                      icon={TONE_ICONS[view.tone]}
                      tone={tone}
                      title={view.title}
                      caption={view.detail}
                      trailing={<Badge tone={view.tone}>{view.label}</Badge>}
                    />
                  );
                })}
              </div>
            )}
          </SectionCard>
          <SectionCard title="Historique">
            <Timeline
              label="Historique de la pièce"
              items={piece.history.map((entry) => ({ id: entry.id, title: entry.title, detail: entry.detail, icon: FileCheck, tone: entry.tone }))}
            />
          </SectionCard>
        </div>
        <aside className="flex min-w-0 flex-col gap-3">
          <SectionCard title="La pièce">
            <DetailList items={detailItems} />
          </SectionCard>
          <SectionCard title="Renouvellement">
            {piece.renewable ? (
              <p className="text-body text-fg-muted">
                {filingOpen
                  ? "Le délai de dépôt conseillé, trois mois avant l’échéance, est atteint."
                  : `Dépôt conseillé trois mois avant l’échéance, soit à partir du ${formatDate(filingStart)}.`}
                {blocking.length > 0
                  ? ` ${joinList(blocking.map((other) => `${other.renewalSubject} doit être renouvelée avant le ${formatDate(other.expiresOn)}`))}.`
                  : ""}
              </p>
            ) : (
              <p className="text-body text-fg-muted">{piece.upkeepNote}</p>
            )}
            {toRenew.map((candidate) => (
              <div key={candidate.id}>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setRenewing(candidate);
                  }}
                >
                  <Icon icon={ShieldCheck} />
                  {candidate.renewalAction}
                </Button>
              </div>
            ))}
          </SectionCard>
        </aside>
      </div>
      <ReminderDialog piece={piece} open={reminding} onOpenChange={setReminding} />
      {renewing ? (
        <RenewDialog
          piece={renewing}
          open
          onOpenChange={(open) => {
            if (!open) setRenewing(null);
          }}
        />
      ) : null}
    </PageFrame>
  );
}
