"use client";

import { Alert, Avatar, Badge, Button, Icon, StatCard, Tab, TabList, TabPanel, Tabs } from "@eguardimmo/ui";
import { CircleCheck, FileText, MessageSquare, Wrench } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { daysBetween, formatDate, formatDayMonth, monthName, plural } from "../data/dates";
import { findLot, lotTotalRent, pendingSettlement, rentState } from "../data/derive";
import { useConfie } from "../data/queries";
import type { ConfieData, Lot, ScheduleEntry } from "../data/schemas";
import { eur, eurFixed, feeOf } from "../data/money";
import { confieRoutes } from "../routes";
import { DataList } from "../ui/DataList";
import { DataTable } from "../ui/DataTable";
import type { Column, TableRow } from "../ui/DataTable";
import { ListRow, RowList } from "../ui/ListRow";
import { PageHeader } from "../ui/PageHeader";
import { DownloadButton, INTERVENTION_STATUS, RentStateBadge, TextLink } from "../ui/parts";
import { Caption, Pair, Section, Split, StatGrid } from "../ui/Section";
import { EmptyLine, NotFoundState, QueryBoundary } from "../ui/States";

export function BienScreen({ id }: { id: string }) {
  const query = useConfie();
  return (
    <QueryBoundary query={query}>
      {(data) => {
        const lot = findLot(data, id);
        return lot ? <Bien data={data} lot={lot} /> : <NotFoundState title="Bien introuvable" backHref={confieRoutes.biens} backLabel="Retour à mes biens" />;
      }}
    </QueryBoundary>
  );
}

function scheduleState(entry: ScheduleEntry, today: string) {
  if (entry.collected >= entry.called) return { tone: "success" as const, label: entry.paidOn ? `Payé le ${formatDayMonth(entry.paidOn)}` : "Payé" };
  if (daysBetween(entry.dueOn, today) > 0) return { tone: "danger" as const, label: "Impayé" };
  return { tone: "neutral" as const, label: "À venir" };
}

function Bien({ data, lot }: { data: ConfieData; lot: Lot }) {
  const [tab, setTab] = useState("resume");
  const documents = data.documents.filter((document) => document.lotIds.includes(lot.id));
  const interventions = data.interventions.filter((item) => item.lotId === lot.id);
  const state = rentState(lot, data.today);
  const month = monthName(data.today.slice(0, 7));
  const schedule = [...lot.schedule].reverse();
  const fee = feeOf(state.collected, data.mandate.feeRatePercent);
  const settlement = pendingSettlement(data);
  const unpaidAmount = state.called - state.collected;
  const dueOn = lot.schedule.find((entry) => entry.month === data.today.slice(0, 7))?.dueOn ?? data.today;
  const followed = lot.followUps.find((item) => item.state === "done");

  return (
    <>
      <PageHeader
        title={lot.label}
        crumbs={[{ label: "Mes biens", href: confieRoutes.biens }, { label: lot.label }]}
        badges={
          <>
            <Badge tone="success">Loué</Badge>
            {state.kind === "paid" ? <Badge tone="success">Loyer payé</Badge> : <RentStateBadge state={state} />}
          </>
        }
        subtitle={`${lot.kind}, ${String(lot.surface)} m² · ${lot.address} · ${lot.floorRank} étage${lot.elevator ? ", ascenseur" : ""}`}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href={confieRoutes.messageNouveau}><Icon icon={MessageSquare} />Écrire à l&apos;agence</Link>
            </Button>
            <Button onClick={() => { setTab("documents"); }}>
              <Icon icon={FileText} />Voir les documents
            </Button>
          </>
        }
      />
      <Tabs value={tab} defaultValue="resume" onValueChange={setTab}>
        <TabList aria-label={`Sections de ${lot.label}`}>
          <Tab value="resume">Résumé</Tab>
          <Tab value="loyers" count={lot.schedule.length}>Loyers</Tab>
          <Tab value="documents" count={documents.length}>Documents</Tab>
          <Tab value="interventions" count={interventions.length}>Interventions</Tab>
        </TabList>
        <TabPanel value="resume" className="mt-3 flex flex-col gap-3">
          {state.kind === "overdue" ? (
            <Alert tone="danger" title={`Loyer de ${month} impayé, ${eur(unpaidAmount)}`}>
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Échéance du {formatDate(dueOn)}, retard de {plural(state.days, "jour")}.
                  {followed ? ` L'agence a relancé le locataire le ${formatDate(followed.on)}.` : ""}
                </span>
                <Button variant="secondary" size="sm" asChild><Link href={confieRoutes.messageNouveau}>Écrire à l&apos;agence</Link></Button>
              </span>
            </Alert>
          ) : null}
          <StatGrid>
            <StatCard label="Loyer charges comprises" value={eur(lotTotalRent(lot))}>
              <Caption>{eur(lot.rent.base)} de loyer et {eur(lot.rent.provisions)} de provisions</Caption>
            </StatCard>
            <StatCard label={`Encaissé en ${month}`} tone={state.kind === "overdue" ? "danger" : "default"} value={eur(state.collected)}>
              <Caption>{state.kind === "paid" && state.paidOn ? `Payé le ${formatDate(state.paidOn)}` : `Sur ${eur(state.called)} appelés`}</Caption>
            </StatCard>
            {state.kind === "overdue" ? (
              <StatCard label="Impayé" tone="danger" value={eur(unpaidAmount)}>
                <Caption>Depuis le {formatDate(dueOn)}</Caption>
              </StatCard>
            ) : (
              <StatCard label={`Honoraires de ${month}`} value={eurFixed(fee)}>
                <Caption>{data.mandate.feeRatePercent} % TTC sur {eur(state.collected)}</Caption>
              </StatCard>
            )}
            <StatCard label="Reversement prévu" value={eurFixed(state.collected - fee)}>
              <Caption>{state.collected > 0 && settlement ? `Le ${formatDate(settlement.reversedOn)}` : "Aucun loyer encaissé ce mois"}</Caption>
            </StatCard>
          </StatGrid>
          <Split>
            <Section title="Caractéristiques">
              <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 md:grid-cols-2">
                <DataList items={[{ label: "Type", value: lot.kind }, { label: "Surface", value: `${String(lot.surface)} m²` }, { label: "Étage", value: `${lot.floorRank}${lot.elevator ? ", ascenseur" : ""}` }]} />
                <DataList items={[{ label: "Chauffage", value: lot.heating }, { label: "DPE", value: lot.dpe }, { label: "Lot", value: `Lot n° ${String(lot.lotNumber)}` }]} />
              </div>
            </Section>
            <Section title="Locataire">
              <div className="flex items-center gap-2.5">
                <Avatar initials={lot.tenant.initials} size="md" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="text-body-strong text-fg">{lot.tenant.name}</b>
                  <Caption>Bail en cours jusqu&apos;au {formatDate(lot.tenant.leaseEndOn)}</Caption>
                </span>
                <Badge tone={state.kind === "overdue" ? "danger" : "success"}>{state.kind === "overdue" ? "Impayé" : "À jour"}</Badge>
              </div>
              <DataList
                width="lg"
                items={[
                  { label: "Loyer", value: `${eur(lotTotalRent(lot))} charges comprises` },
                  { label: "Dernier paiement", value: formatDate(lot.lastPaymentOn) },
                ]}
              />
              <Caption>Seuls le nom, le loyer et l&apos;état de paiement du locataire vous sont communiqués.</Caption>
            </Section>
          </Split>
          <Split>
            <Section title="Dernières échéances" aside={<Button variant="link" size="sm" onClick={() => { setTab("loyers"); }}>Tout voir, {lot.schedule.length}</Button>}>
              <ScheduleTable lot={lot} entries={schedule.slice(0, 3)} today={data.today} />
            </Section>
            <Section title={lot.followUps.length > 0 ? "Suivi de l'impayé et devis" : "Intervention récente"}>
              <InterventionRows data={data} lot={lot} />
            </Section>
          </Split>
        </TabPanel>
        <TabPanel value="loyers" className="mt-3">
          <Section title={`Échéances, ${lot.label}`}>
            <ScheduleTable lot={lot} entries={schedule} today={data.today} />
          </Section>
        </TabPanel>
        <TabPanel value="documents" className="mt-3">
          <Section title={`Documents, ${lot.label}`} aside={<TextLink href={confieRoutes.documents}>Tous mes documents</TextLink>}>
            {documents.length === 0 ? <EmptyLine>Aucun document pour ce lot.</EmptyLine> : (
              <RowList label={`Documents, ${lot.label}`}>
                {documents.map((document) => (
                  <ListRow key={document.id} icon={FileText} title={document.title} detail={`${document.detail} · ${formatDate(document.date)}`} trailing={<DownloadButton title={document.title} />} />
                ))}
              </RowList>
            )}
          </Section>
        </TabPanel>
        <TabPanel value="interventions" className="mt-3">
          <Pair>
            <Section title={`Interventions, ${lot.label}`}>
              <InterventionRows data={data} lot={lot} />
            </Section>
          </Pair>
        </TabPanel>
      </Tabs>
    </>
  );
}

function ScheduleTable({ lot, entries, today }: { lot: Lot; entries: readonly ScheduleEntry[]; today: string }) {
  const columns: Column<ScheduleEntry>[] = [
    { id: "month", header: "Échéance", primary: true, cell: (entry) => formatDate(entry.dueOn) },
    { id: "called", header: "Appelé", align: "end", cell: (entry) => eur(entry.called) },
    { id: "collected", header: "Encaissé", align: "end", cell: (entry) => <span className={entry.collected < entry.called ? "font-semibold text-fg-danger" : undefined}>{eur(entry.collected)}</span> },
    {
      id: "state",
      header: "État",
      cell: (entry) => {
        const state = scheduleState(entry, today);
        return <Badge tone={state.tone}>{state.label}</Badge>;
      },
    },
  ];
  const rows: TableRow<ScheduleEntry>[] = entries.map((entry) => ({ key: entry.month, value: entry }));
  return <DataTable caption={`Échéances de loyer, ${lot.label}`} columns={columns} rows={rows} />;
}

function InterventionRows({ data, lot }: { data: ConfieData; lot: Lot }) {
  const interventions = data.interventions.filter((item) => item.lotId === lot.id);
  const hasPending = interventions.some((item) => item.status === "quote_pending");
  const lastDone = interventions.find((item) => item.status === "done");
  return (
    <RowList label={`Suivi, ${lot.label}`}>
      {lot.followUps.map((item) => (
        <ListRow key={item.id} icon={item.state === "done" ? CircleCheck : Wrench} tone={item.state === "done" ? "default" : "warning"} title={item.title} detail={item.detail} trailing={item.state === "planned" ? <Badge>Prévue</Badge> : undefined} />
      ))}
      {interventions.map((item) => {
        const status = INTERVENTION_STATUS[item.status];
        return (
          <ListRow
            key={item.id}
            icon={item.status === "done" ? CircleCheck : Wrench}
            tone={item.status === "done" ? "success" : "warning"}
            title={<Link href={item.status === "quote_pending" ? confieRoutes.devis(item.id) : confieRoutes.intervention(item.id)} className="underline-offset-3 hover:underline">{item.status === "quote_pending" ? `Devis de ${item.category.toLowerCase()}, ${item.title.toLowerCase()}` : item.title}</Link>}
            detail={item.status === "done" && item.doneOn ? `Terminée le ${formatDate(item.doneOn)} · ${eurFixed(item.totalTtc)} TTC` : `${eurFixed(item.totalTtc)} TTC${item.quote ? ` · avant le ${formatDate(item.quote.decideBefore)}` : ""}`}
            trailing={<Badge tone={status.tone}>{status.label}</Badge>}
          />
        );
      })}
      {!hasPending && lastDone ? (
        <ListRow icon={Wrench} tone="default" title="Aucune intervention en cours" detail={lastDone.imputedOn ? `Les ${eurFixed(lastDone.totalTtc)} ont été déduits du reversement du ${formatDate(lastDone.imputedOn)}` : undefined} />
      ) : null}
      {interventions.length === 0 && lot.followUps.length === 0 ? <EmptyLine>Aucune intervention sur ce lot.</EmptyLine> : null}
    </RowList>
  );
}
