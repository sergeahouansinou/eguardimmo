"use client";

import {
  Avatar,
  Badge,
  Button,
  StatCard,
  Tab,
  TabList,
  TabPanel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Tabs,
  useToast,
} from "@eguardimmo/ui";
import { Wrench } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { EditDialog } from "@/components/ui/EditDialog";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { ListRow } from "@/components/ui/ListRow";
import { NotFoundState } from "@/components/ui/NotFoundState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PillBadge } from "@/components/ui/PillBadge";
import { QueryState } from "@/components/ui/QueryState";
import { RowMenu } from "@/components/ui/RowMenu";
import { SectionCard } from "@/components/ui/SectionCard";
import { agenceRoutes, bailHref, bailNewHref, locataireHref, mandantHref, mandatHref } from "@/espace/routes";
import { formatDay, monthName, ofMonth } from "@/lib/dates";
import { applyRate, formatEuros, formatEurosExact, formatRate } from "@/lib/money";
import { initialsOf } from "@/lib/text";
import { bienDocuments, eventsFor } from "../detailItems";
import { PAYMENT_MODE_LABELS, bienPill } from "../labels";
import { usePatchEntity, usePortefeuille } from "../queries";
import { buildSchedule, calledMinor } from "../selectors";
import type { Portefeuille } from "../selectors";
import { DocumentList } from "../shared/DocumentList";
import { EventList } from "../shared/EventList";

const bienSchema = z.object({
  floor: z.string().trim().min(1, "Indiquez l'étage, par exemple 3e sur 5, ascenseur."),
  heating: z.string().trim().min(1, "Indiquez le chauffage, par exemple Individuel, gaz."),
  syndic: z.string().trim().min(1, "Indiquez le syndic, par exemple Cabinet Lefèvre."),
});

type TabValue = "resume" | "encaissements" | "documents" | "interventions" | "historique";

export function BienDetailPage({ id }: { id: string }) {
  const query = usePortefeuille();
  return (
    <QueryState query={query} label="La fiche du bien">
      {(index) => <BienDetail index={index} id={id} />}
    </QueryState>
  );
}

function BienDetail({ index, id }: { index: Portefeuille; id: string }) {
  const bien = index.bien(id);
  const [tab, setTab] = useState<TabValue>("resume");
  const [editing, setEditing] = useState(false);
  const patch = usePatchEntity();
  const toast = useToast();
  if (!bien) {
    return <NotFoundState title="Bien introuvable" description={`Aucun lot ne porte l'identifiant « ${id} ».`} backHref={agenceRoutes.biens} backLabel="Retour aux biens" />;
  }

  const { data } = index;
  const mandat = index.mandat(bien.mandatId);
  const mandant = index.mandantOfBien(bien);
  const bail = index.currentBail(bien.id);
  const tenant = bail ? index.locataire(bail.locataireId) : undefined;
  const schedule = bail ? buildSchedule(bail, data.todayIso) : [];
  const payments = schedule.filter((echeance) => echeance.state === "paye");
  const documents = bienDocuments(bien);
  const interventions = data.interventions.filter((item) => item.bienId === bien.id);
  const events = eventsFor(index, "bien", bien.id);
  const lastPayment = payments[0];
  const fee = (collected: number) => applyRate(collected, mandat?.feeBasisPoints ?? 0);
  const month = monthName(data.todayIso);
  const pill = bienPill(bail, data.todayIso);
  const target = bien.targetRentMinor === undefined ? undefined : bien.targetRentMinor + (bien.targetChargesMinor ?? 0);

  const paymentsTable = (limit?: number) => {
    const shown = limit === undefined ? payments : payments.slice(0, limit);
    if (shown.length === 0) return <p className="py-2 text-body text-fg-subtle">Aucun encaissement enregistré.</p>;
    return (
      <Table aria-label="Encaissements du lot">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Date</TableHeaderCell>
            <TableHeaderCell>Libellé</TableHeaderCell>
            <TableHeaderCell>Mode</TableHeaderCell>
            <TableHeaderCell numeric>Montant</TableHeaderCell>
            <TableHeaderCell numeric>Honoraires</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {shown.map((echeance) => (
            <TableRow key={echeance.id}>
              <TableCell>{formatDay(echeance.paidIso ?? echeance.dueIso)}</TableCell>
              <TableCell>{`Échéance ${ofMonth(echeance.dueIso)}`}</TableCell>
              <TableCell>{PAYMENT_MODE_LABELS[echeance.mode]}</TableCell>
              <TableCell numeric>{formatEurosExact(echeance.collectedMinor)}</TableCell>
              <TableCell numeric>{formatEurosExact(fee(echeance.collectedMinor))}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const interventionList = (limit?: number) => {
    const shown = limit === undefined ? interventions : interventions.slice(0, limit);
    if (shown.length === 0) return <p className="py-2 text-body text-fg-subtle">Aucune intervention sur ce lot.</p>;
    return (
      <div>
        {shown.map((item) => (
          <ListRow
            key={item.id}
            icon={Wrench}
            tone="success"
            title={item.title}
            caption={`${formatDay(item.dateIso)} · ${formatEuros(item.amountMinor)}${item.note ? ` · ${item.note}` : ""}`}
            trailing={<Badge tone={item.done ? "success" : "info"}>{item.done ? "Terminée" : "En cours"}</Badge>}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Biens sous mandat", href: agenceRoutes.biens }, { label: bien.name }]}
        title={bien.name}
        badges={
          <>
            <Badge tone={bail ? "success" : "neutral"}>{bail ? "Loué" : "Vacant"}</Badge>
            <PillBadge pill={bail ? { ...pill, label: pill.label === "Payé" ? "Loyer payé" : pill.label } : pill} />
          </>
        }
        description={`${bien.kind}, ${String(bien.surfaceM2)} m² · ${bien.street}, ${bien.postalCode} ${bien.city} · ${mandant?.name ?? "Mandant inconnu"}, mandat ${mandat?.number ?? "—"}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => { setEditing(true); }}>
              Modifier
            </Button>
            <Button variant="secondary" asChild>
              <Link href={agenceRoutes.messageNew}>Écrire au locataire</Link>
            </Button>
            <Button asChild>
              <Link href={agenceRoutes.encaissementNew}>Enregistrer un paiement</Link>
            </Button>
            <RowMenu
              label={`Autres actions pour le lot ${bien.name}`}
              items={[
                ...(mandat ? [{ id: "mandat", label: "Voir le mandat", href: mandatHref(mandat.id) }] : []),
                ...(bail ? [{ id: "bail", label: "Voir le bail", href: bailHref(bail.id) }] : []),
              ]}
            />
          </>
        }
      />

      <Tabs value={tab} defaultValue="resume" onValueChange={(next) => { setTab(next as TabValue); }}>
        <TabList aria-label="Sections de la fiche bien">
          <Tab value="resume">Résumé</Tab>
          <Tab value="encaissements" count={payments.length}>Encaissements</Tab>
          <Tab value="documents" count={documents.length}>Documents</Tab>
          <Tab value="interventions" count={interventions.length}>Interventions</Tab>
          <Tab value="historique" count={events.length}>Historique</Tab>
        </TabList>

        <TabPanel value="resume" className="flex min-w-0 flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Loyer charges comprises" value={bail ? formatEurosExact(calledMinor(bail)) : target === undefined ? "—" : formatEurosExact(target)}>
              <span className="text-caption text-fg-subtle">{bail ? `${formatEuros(bail.rentMinor)} de loyer et ${formatEuros(bail.chargesMinor)} de provisions` : target === undefined ? "aucun bail en cours" : "loyer visé, aucun bail en cours"}</span>
            </StatCard>
            <StatCard label={`Encaissé en ${month}`} value={bail ? formatEurosExact(bail.overdueSinceIso ? 0 : calledMinor(bail)) : "—"} tone={bail?.overdueSinceIso ? "danger" : "default"}>
              <span className="text-caption text-fg-subtle">{bail?.overdueSinceIso ? "Non réglé" : lastPayment?.paidIso ? `Payé le ${formatDay(lastPayment.paidIso)}` : "—"}</span>
            </StatCard>
            <StatCard label="Honoraires du mois" value={formatEurosExact(bail && !bail.overdueSinceIso ? fee(calledMinor(bail)) : 0)}>
              <span className="text-caption text-fg-subtle">{`${formatRate(mandat?.feeBasisPoints ?? 0)} TTC`}</span>
            </StatCard>
            <StatCard label="Dépôt de garantie" value={bail ? formatEuros(bail.depositMinor) : "—"}>
              <span className="text-caption text-fg-subtle">{bail ? `Détenu depuis le ${formatDay(bail.startIso)}` : "aucun dépôt détenu"}</span>
            </StatCard>
          </div>

          <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-3">
              <SectionCard title="Caractéristiques" action={<Button variant="link" onClick={() => { setEditing(true); }}>Modifier</Button>}>
                <KeyValueList
                  columns={2}
                  items={[
                    { label: "Type", value: `${bien.kind}, ${String(bien.surfaceM2)} m²` },
                    { label: "Étage", value: bien.floor },
                    { label: "Adresse", value: `${bien.street}, ${bien.postalCode} ${bien.city}` },
                    { label: "Mandant", value: mandant ? (mandant.legal === "Particulier" ? mandant.name : `${mandant.name}, ${mandant.legal}`) : "—" },
                    { label: "Mandat", value: mandat?.number ?? "—" },
                    { label: "DPE", value: bien.dpe },
                    { label: "Chauffage", value: bien.heating },
                    { label: "Syndic", value: bien.syndic },
                    { label: "Assurance PNO", value: `Valable jusqu'au ${formatDay(bien.pnoUntilIso)}` },
                    { label: "Taxe foncière", value: bien.propertyTax },
                  ]}
                />
              </SectionCard>
              <SectionCard title="Derniers encaissements" action={<Button variant="link" onClick={() => { setTab("encaissements"); }}>{`Tout voir, ${String(payments.length)}`}</Button>}>
                {paymentsTable(3)}
              </SectionCard>
              <SectionCard title="Interventions" action={<Button variant="link" onClick={() => { setTab("interventions"); }}>{`Tout voir, ${String(interventions.length)}`}</Button>}>
                {interventionList(2)}
              </SectionCard>
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <SectionCard title="Occupation">
                {bail && tenant ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Avatar initials={initialsOf(tenant.name)} size="md" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <strong className="truncate text-body-strong text-fg">{tenant.name}</strong>
                        <span className="truncate text-caption text-fg-subtle">{`Locataire · bail ${bail.number}`}</span>
                      </div>
                      <Button variant="link" asChild>
                        <Link href={locataireHref(tenant.id)} aria-label={`Ouvrir la fiche de ${tenant.name}`}>Ouvrir</Link>
                      </Button>
                    </div>
                    <ListRow
                      title={`Bail du ${formatDay(bail.startIso)} au ${formatDay(bail.endIso)}`}
                      caption={`${bail.furnished ? "Meublé" : "Vide"} · ${formatEuros(bail.rentMinor)} + ${formatEuros(bail.chargesMinor)} de provisions`}
                      trailing={
                        <Button variant="link" asChild>
                          <Link href={bailHref(bail.id)} aria-label={`Ouvrir le bail ${bail.number}`}>Ouvrir</Link>
                        </Button>
                      }
                    />
                  </>
                ) : (
                  <>
                    <p className="text-body text-fg-subtle">Ce lot est vacant.</p>
                    <div>
                      <Button variant="secondary" size="sm" asChild>
                        <Link href={bailNewHref(bien.id)}>Créer un bail</Link>
                      </Button>
                    </div>
                  </>
                )}
              </SectionCard>
              {mandant ? (
                <SectionCard title="Mandant" action={<Button variant="link" asChild><Link href={mandantHref(mandant.id)}>Ouvrir</Link></Button>}>
                  <p className="text-body text-fg">{mandant.name}</p>
                  <p className="text-caption text-fg-subtle">{`${mandant.legal} · mandat ${mandat?.number ?? "—"}`}</p>
                </SectionCard>
              ) : null}
            </div>
          </div>
        </TabPanel>

        <TabPanel value="encaissements">
          <SectionCard title="Encaissements">{paymentsTable()}</SectionCard>
        </TabPanel>
        <TabPanel value="documents">
          <SectionCard title="Documents">
            <DocumentList items={documents} />
          </SectionCard>
        </TabPanel>
        <TabPanel value="interventions">
          <SectionCard title="Interventions">{interventionList()}</SectionCard>
        </TabPanel>
        <TabPanel value="historique">
          <SectionCard title="Historique">
            <EventList events={events} />
          </SectionCard>
        </TabPanel>
      </Tabs>

      {editing ? (
        <EditDialog
          open
          onOpenChange={setEditing}
          title="Modifier les caractéristiques"
          fields={[
            { name: "floor", label: "Étage", placeholder: "3e sur 5, ascenseur", value: bien.floor },
            { name: "heating", label: "Chauffage", placeholder: "Individuel, gaz", value: bien.heating },
            { name: "syndic", label: "Syndic", placeholder: "Cabinet Lefèvre", value: bien.syndic },
          ]}
          schema={bienSchema}
          onSubmit={async (values) => {
            await patch.mutateAsync({ kind: "bien", id: bien.id, patch: values });
            toast.show({ title: "Caractéristiques mises à jour", description: bien.name });
          }}
        />
      ) : null}
    </>
  );
}
