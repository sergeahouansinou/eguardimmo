"use client";

import { Badge } from "@eguardimmo/ui";
import { CalendarClock, Landmark } from "lucide-react";
import { DataTable } from "@/features/confie/ui/DataTable";
import type { Column } from "@/features/confie/ui/DataTable";
import { ListRow, RowList } from "@/features/confie/ui/ListRow";
import { EmptyLine } from "@/features/confie/ui/States";
import { Section } from "@/features/confie/ui/Section";
import { Alert } from "@eguardimmo/ui";
import { NOT_AVAILABLE, agencyAndMandant, formatMoney, formatOptionalDay, labelOf } from "../format";
import { FailureNotice, Loading } from "../screens/FailureNotice";
import { PagedState } from "../shared/PagedState";
import { PAYOUT_STATUS } from "./labels";
import type { Payout, UpcomingPayout } from "./model";
import { usePayouts } from "./queries";

const columns: readonly Column<Payout>[] = [
  { id: "numero", header: "Numéro", primary: true, cell: (payout) => payout.number },
  { id: "date", header: "Date", cell: (payout) => formatOptionalDay(payout.date) },
  {
    id: "statut",
    header: "Statut",
    cell: (payout) => {
      const entry = PAYOUT_STATUS[payout.status];
      return <Badge tone={entry?.tone ?? "neutral"}>{entry?.label ?? labelOf({}, payout.status)}</Badge>;
    },
  },
  { id: "montant", header: "Montant", align: "end", cell: (payout) => formatMoney(payout.amount) },
  { id: "compte", header: "Compte", cell: (payout) => (payout.bankLast4 === null ? NOT_AVAILABLE : `•••• ${payout.bankLast4}`) },
  { id: "mandat", header: "Mandat", cell: (payout) => agencyAndMandant(payout.agency.name, payout.mandantName) },
];

function UpcomingRow({ entry }: { entry: UpcomingPayout }) {
  const when = entry.date === null ? "Date non communiquée" : `Prévu autour du ${formatOptionalDay(entry.date)}`;
  return (
    <ListRow
      icon={CalendarClock}
      title={agencyAndMandant(entry.agency.name, entry.mandantName)}
      detail={entry.notice === null ? `${when} (indicatif)` : `${when} (indicatif) · ${entry.notice.message}`}
      tone={entry.notice === null ? "default" : "warning"}
    />
  );
}

export function PayoutsSections({ agency, enabled, coOwnerOnly }: { agency: string | null; enabled: boolean; coOwnerOnly: boolean }) {
  const list = usePayouts(agency, enabled);
  const upcoming = list.pages[0]?.upcoming ?? [];
  return (
    <>
      {coOwnerOnly ? (
        <Alert tone="info" title="Reversements non visibles">
          En tant que co-indivisaire, vous n’avez pas accès aux reversements : ils sont versés au titulaire du mandat.
        </Alert>
      ) : null}
      <Section title="Prochain reversement">
        {!list.loaded ? (
          list.failed ? <FailureNotice title="Le prochain reversement n’a pas pu être chargé" error={list.error} onRetry={list.retry} /> : <Loading label="Chargement du prochain reversement" rows={1} />
        ) : upcoming.length === 0 ? (
          <EmptyLine>Aucun reversement à venir pour le moment.</EmptyLine>
        ) : (
          <RowList label="Prochains reversements">
            {upcoming.map((entry) => (
              <UpcomingRow key={`${entry.agency.id}-${entry.mandantName ?? ""}`} entry={entry} />
            ))}
          </RowList>
        )}
      </Section>
      <PagedState
        list={list}
        loadingLabel="Chargement des reversements"
        failureTitle="Vos reversements n’ont pas pu être chargés"
        empty={{ icon: Landmark, title: "Aucun reversement", description: "Aucun reversement n’a encore été programmé ou versé pour cette sélection." }}
      >
        {(payouts) => (
          <Section title="Reversements">
            <DataTable caption="Reversements" columns={columns} rows={payouts.map((payout) => ({ key: payout.id, value: payout }))} />
          </Section>
        )}
      </PagedState>
    </>
  );
}
