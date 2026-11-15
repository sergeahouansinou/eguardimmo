"use client";

import { Button, EmptyState, Icon } from "@eguardimmo/ui";
import { FileCheck, Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ActionAlert } from "@/components/ui/ActionAlert";
import { QueryState } from "@/components/ui/QueryState";
import { SectionCard } from "@/components/ui/SectionCard";
import { DataTable } from "@/features/kit/DataTable";
import { DetailList } from "@/features/kit/Details";
import { Kpi, KpiGrid } from "@/features/kit/Kpi";
import { LinkButton } from "@/features/kit/LinkButton";
import { PageFrame } from "@/features/kit/PageFrame";
import { DEMO_TODAY, daysBetween, formatDate } from "@/features/shared/dates";
import { AddPieceDialog } from "./AddPieceDialog";
import { alertDaysLabel, channelsLabel, computeStats, inDaysLabel, pieceStatus, recipientsLabel, remainingLabel, renewalThreshold } from "./logic";
import { RemindersSettingsDialog } from "./ReminderDialogs";
import { useConformite } from "./queries";
import { StatusBadge } from "./StatusBadge";
import type { ConformiteData, Piece } from "./schemas";

export function ConformitePage() {
  const query = useConformite();
  return (
    <QueryState query={query} label="La conformité">
      {(data) => <Conformite data={data} />}
    </QueryState>
  );
}

function Conformite({ data }: { data: ConformiteData }) {
  const [adding, setAdding] = useState(false);
  const [editingReminders, setEditingReminders] = useState(false);
  const threshold = renewalThreshold(data.reminders);
  const stats = computeStats(data.pieces, threshold);
  const alerts = stats.toRenew;
  const carte = data.pieces.find((piece) => piece.id === "carte-professionnelle");

  return (
    <PageFrame
      crumbs={[{ label: "Suivi" }, { label: "Conformité" }]}
      title="Conformité"
      description="Pièces qui autorisent l’agence à gérer des biens, avec leurs échéances."
      actions={
        <Button
          variant="secondary"
          onClick={() => {
            setAdding(true);
          }}
        >
          Ajouter une pièce
        </Button>
      }
    >
      {alerts.map((piece) => {
        const status = pieceStatus(piece, threshold);
        return (
          <ActionAlert
            key={piece.id}
            tone={status.level === "expired" ? "danger" : "warning"}
            title={`${piece.fullTitle}, ${status.level === "expired" ? "échue" : "à renouveler"}`}
            action={
              <LinkButton href={`/conformite/${piece.id}`} variant="secondary" size="sm">
                Voir la pièce
              </LinkButton>
            }
          >
            Échéance le {formatDate(piece.expiresOn)}. {piece.renewalImpact ?? ""}
          </ActionAlert>
        );
      })}
      <KpiGrid columns={4}>
        <Kpi label="Pièces suivies" value={String(stats.total)} hint={stats.withoutFile === 0 ? "toutes déposées" : `${String(stats.withoutFile)} sans fichier`} />
        <Kpi
          label="Valides"
          value={String(stats.valid)}
          hint={carte && pieceStatus(carte, threshold).level === "valid" ? "dont la carte professionnelle" : "carte professionnelle à surveiller"}
        />
        <Kpi
          label="À renouveler"
          value={String(stats.toRenew.length)}
          tone={stats.toRenew.length > 0 ? "danger" : "default"}
          hint={stats.toRenew.length > 0 ? stats.toRenew.map((piece) => piece.title).join(", ") : "aucune pièce"}
        />
        <Kpi
          label="Prochaine échéance"
          value={stats.next ? formatDate(stats.next.expiresOn) : "Aucune"}
          hint={stats.next ? inDaysLabel(daysBetween(DEMO_TODAY, stats.next.expiresOn)) : "aucune pièce suivie"}
        />
      </KpiGrid>
      <SectionCard title="Pièces de conformité">
        <DataTable<Piece>
          caption="Pièces de conformité"
          rows={data.pieces}
          getRowId={(piece) => piece.id}
          empty={
            <EmptyState
              icon={FileCheck}
              title="Aucune pièce suivie"
              description="Ajoutez la carte professionnelle, la garantie financière ou l’assurance RCP pour suivre leurs échéances."
            />
          }
          columns={[
            {
              id: "piece",
              header: "Pièce",
              role: "title",
              cell: (piece) => (
                <span className="flex min-w-0 flex-col">
                  <span className="text-body-strong">{piece.title}</span>
                  <span className="text-caption font-normal text-fg-subtle">{piece.subtitle}</span>
                </span>
              ),
            },
            { id: "reference", header: "Référence", cell: (piece) => piece.reference },
            { id: "expiresOn", header: "Échéance", cell: (piece) => formatDate(piece.expiresOn) },
            { id: "remaining", header: "Reste", cell: (piece) => remainingLabel(piece) },
            { id: "status", header: "État", role: "status", cell: (piece) => <StatusBadge status={pieceStatus(piece, threshold)} /> },
            {
              id: "action",
              header: "Action",
              role: "action",
              hideHeader: true,
              cell: (piece) => (
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/conformite/${piece.id}`} aria-label={`Voir ${piece.title}`}>
                    Voir
                  </Link>
                </Button>
              ),
            },
          ]}
        />
      </SectionCard>
      <SectionCard
        title="Rappels d’échéance"
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditingReminders(true);
            }}
          >
            <Icon icon={Pencil} />
            Modifier
          </Button>
        }
      >
        <DetailList
          items={[
            { label: "Alertes", value: alertDaysLabel(data.reminders.days) },
            { label: "Destinataires", value: recipientsLabel(data.reminders.recipients) },
            { label: "Canal", value: channelsLabel(data.reminders.channels) },
          ]}
        />
      </SectionCard>
      <AddPieceDialog open={adding} onOpenChange={setAdding} />
      <RemindersSettingsDialog reminders={data.reminders} open={editingReminders} onOpenChange={setEditingReminders} />
    </PageFrame>
  );
}
