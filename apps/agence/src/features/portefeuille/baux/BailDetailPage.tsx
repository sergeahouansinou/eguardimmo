"use client";

import { Alert, Badge, Button, ConfirmDialog, StatCard, Tab, TabList, TabPanel, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, Tabs, useToast } from "@eguardimmo/ui";
import { ClipboardCheck } from "lucide-react";
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
import { useDemoDownload } from "@/components/ui/useDemoDownload";
import { agenceRoutes, avisEcheanceHref, bienHref, locataireHref, mandantHref } from "@/espace/routes";
import { addMonths, formatDay, monthName, parseDay, relativeMonths } from "@/lib/dates";
import { formatEuros, formatEurosExact } from "@/lib/money";
import { bailActions, bailDocuments, eventsFor } from "../detailItems";
import { PAYMENT_MODE_LABELS, bailKindLabel, bailPill } from "../labels";
import { usePatchEntity, usePortefeuille } from "../queries";
import { buildSchedule, calledMinor, nextPayoutIso } from "../selectors";
import type { Portefeuille } from "../selectors";
import { DocumentList } from "../shared/DocumentList";
import { EventList } from "../shared/EventList";

const conditionsSchema = z.object({
  dueDay: z.string().regex(/^(?:[1-9]|1\d|2[0-8])$/, "Indiquez un jour entre 1 et 28, par exemple 5."),
  note: z.string().trim().max(500, "La note ne dépasse pas 500 caractères."),
});

type TabValue = "resume" | "echeances" | "documents" | "edl" | "historique" | "sortie";

export function BailDetailPage({ id }: { id: string }) {
  const query = usePortefeuille();
  return (
    <QueryState query={query} label="Le bail">
      {(index) => <BailDetail index={index} id={id} />}
    </QueryState>
  );
}

function BailDetail({ index, id }: { index: Portefeuille; id: string }) {
  const bail = index.bail(id);
  const [tab, setTab] = useState<TabValue>("resume");
  const [editing, setEditing] = useState(false);
  const [noticing, setNoticing] = useState(false);
  const patch = usePatchEntity();
  const toast = useToast();
  const download = useDemoDownload();
  if (!bail) {
    return <NotFoundState title="Bail introuvable" description={`Aucun bail ne porte l'identifiant « ${id} ».`} backHref={agenceRoutes.baux} backLabel="Retour aux baux" />;
  }

  const { data } = index;
  const tenant = index.locataire(bail.locataireId);
  const bien = index.bien(bail.bienId);
  const mandant = bien ? index.mandantOfBien(bien) : undefined;
  const mandat = bien ? index.mandat(bien.mandatId) : undefined;
  const isCurrent = bail.status === "en_cours";
  const isDraft = bail.status === "brouillon";
  const schedule = isDraft ? [] : buildSchedule(bail, data.todayIso);
  const documents = bailDocuments(bail);
  const events = eventsFor(index, "bail", bail.id);
  const actions = bailActions(bail, data.todayIso);
  const nextDue = nextPayoutIso(data.todayIso, bail.dueDay);
  const noticeMonths = bail.furnished ? 1 : 3;
  const restitutionMonths = 1;
  const unpaidCount = schedule.filter((echeance) => echeance.state === "impaye").length;

  const saveNotice = () => {
    patch.mutate(
      { kind: "bail", id: bail.id, patch: { noticeGiven: true } },
      {
        onSuccess: () => {
          toast.show({ title: "Préavis enregistré", description: `Départ prévu le ${formatDay(bail.endIso)}.` });
          setNoticing(false);
        },
        onError: (error) => {
          toast.show({ tone: "danger", title: "Le préavis n'a pas pu être enregistré", description: error.message });
        },
      },
    );
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Baux", href: agenceRoutes.baux }, { label: bail.number }]}
        title={`Bail ${bail.number}`}
        badges={<PillBadge pill={bailPill(bail)} />}
        description={`${tenant?.name ?? "Locataire inconnu"} · ${bien ? `${bien.name}, ${bien.street}` : "lot inconnu"} · du ${formatDay(bail.startIso)} au ${formatDay(bail.endIso)}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => { setEditing(true); }}>
              Modifier
            </Button>
            <Button variant="secondary" onClick={() => { download(`Bail ${bail.number}`); }}>
              Télécharger le bail
            </Button>
            {isCurrent ? (
              <Button asChild>
                <Link href={avisEcheanceHref(bail.id)}>Émettre l&apos;avis d&apos;échéance</Link>
              </Button>
            ) : null}
            {isCurrent ? (
              <Button variant="secondary" asChild>
                <Link href={agenceRoutes.encaissementNew}>Enregistrer un paiement</Link>
              </Button>
            ) : null}
            <RowMenu
              label={`Autres actions pour le bail ${bail.number}`}
              items={[
                ...(tenant ? [{ id: "locataire", label: "Voir le locataire", href: locataireHref(tenant.id) }] : []),
                ...(bien ? [{ id: "lot", label: "Voir le lot", href: bienHref(bien.id) }] : []),
                ...(isCurrent && !bail.noticeGiven ? [{ id: "preavis", label: "Enregistrer un préavis", onSelect: () => { setNoticing(true); } }] : []),
              ]}
            />
          </>
        }
      />

      {bail.overdueSinceIso ? (
        <Alert tone="danger" title={`Loyer impayé depuis le ${formatDay(bail.overdueSinceIso)}`}>
          {`${String(unpaidCount)} ${unpaidCount > 1 ? "échéances restent" : "échéance reste"} à régler, soit ${formatEuros(calledMinor(bail) * unpaidCount)}.`}
        </Alert>
      ) : null}
      {bail.noticeGiven && isCurrent ? (
        <Alert tone="warning" title={`Préavis donné, départ le ${formatDay(bail.endIso)}`}>
          Préparez l&apos;état des lieux de sortie et la restitution du dépôt de garantie.
        </Alert>
      ) : null}
      {isDraft ? (
        <Alert tone="info" title="Bail en brouillon">
          Ce bail n&apos;a pas encore pris effet : aucune échéance n&apos;est appelée tant qu&apos;il n&apos;est pas finalisé.
        </Alert>
      ) : null}

      <Tabs value={tab} defaultValue="resume" onValueChange={(next) => { setTab(next as TabValue); }}>
        <TabList aria-label="Sections du bail">
          <Tab value="resume">Résumé</Tab>
          <Tab value="echeances" count={schedule.length}>Échéances</Tab>
          <Tab value="documents" count={documents.length}>Documents</Tab>
          <Tab value="edl">États des lieux</Tab>
          <Tab value="historique" count={events.length}>Historique</Tab>
          <Tab value="sortie">Sortie</Tab>
        </TabList>

        <TabPanel value="resume" className="flex min-w-0 flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Loyer charges comprises" value={`${formatEuros(calledMinor(bail))} par mois`}>
              <span className="text-caption text-fg-subtle">{`${formatEuros(bail.rentMinor)} de loyer et ${formatEuros(bail.chargesMinor)} de provisions`}</span>
            </StatCard>
            <StatCard label="Dépôt de garantie" value={formatEuros(bail.depositMinor)}>
              <span className="text-caption text-fg-subtle">{bail.depositMinor === 0 ? "aucun dépôt" : "détenu par l'agence"}</span>
            </StatCard>
            <StatCard label="Prochaine échéance" value={isCurrent ? formatDay(nextDue) : "—"}>
              <span className="text-caption text-fg-subtle">{isCurrent ? `le ${String(bail.dueDay)} de chaque mois` : "aucune échéance à venir"}</span>
            </StatCard>
            <StatCard label="Fin du bail" value={formatDay(bail.endIso)}>
              <span className="text-caption text-fg-subtle">{isCurrent ? relativeMonths(data.todayIso, bail.endIso) : bail.status === "termine" ? "bail terminé" : "à venir"}</span>
            </StatCard>
          </div>

          <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-3">
              <SectionCard title="Conditions du bail" action={<Button variant="link" onClick={() => { setEditing(true); }}>Modifier</Button>}>
                <KeyValueList
                  columns={2}
                  items={[
                    { label: "Type", value: `${bailKindLabel(bail)}, ${bail.furnished ? "1 an" : "3 ans"}` },
                    { label: "Début", value: formatDay(bail.startIso) },
                    { label: "Fin", value: formatDay(bail.endIso) },
                    { label: "Loyer hors charges", value: formatEurosExact(bail.rentMinor) },
                    { label: "Provisions sur charges", value: formatEurosExact(bail.chargesMinor) },
                    { label: "Dépôt de garantie", value: formatEurosExact(bail.depositMinor) },
                    { label: "Échéance", value: `Le ${String(bail.dueDay)} du mois` },
                    { label: "Mode de paiement", value: PAYMENT_MODE_LABELS[bail.paymentMode] },
                    { label: "Préavis du locataire", value: `${String(noticeMonths)} mois` },
                    { label: "Garant", value: bail.guarantor ?? "Aucun" },
                    ...(bail.note ? [{ label: "Note", value: bail.note }] : []),
                  ]}
                />
              </SectionCard>
              <SectionCard title="Prochaines actions">
                {isCurrent ? (
                  actions.map((action) => <ListRow key={action.id} title={action.title} caption={action.meta} trailing={<Badge tone="info">{action.badge}</Badge>} />)
                ) : (
                  <p className="py-2 text-body text-fg-subtle">Aucune action à prévoir tant que le bail n&apos;est pas en cours.</p>
                )}
              </SectionCard>
              <SectionCard title="Historique" action={<Button variant="link" onClick={() => { setTab("historique"); }}>{`Tout voir, ${String(events.length)}`}</Button>}>
                <EventList events={events} limit={3} />
              </SectionCard>
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <SectionCard title="Parties">
                <KeyValueList
                  items={[
                    { label: "Locataire", value: tenant?.name ?? "—" },
                    { label: "Bailleur", value: mandant ? (mandant.legal === "Particulier" ? mandant.name : `${mandant.name}, ${mandant.legal}`) : "—" },
                    { label: "Mandataire", value: data.agencyName },
                    { label: "Mandat", value: mandat?.number ?? "—" },
                    { label: "Logement", value: bien ? `${bien.name}, ${bien.street}, ${bien.postalCode} ${bien.city}` : "—" },
                  ]}
                />
                <div className="flex flex-wrap gap-2">
                  {tenant ? (
                    <Button variant="link" asChild>
                      <Link href={locataireHref(tenant.id)}>Fiche du locataire</Link>
                    </Button>
                  ) : null}
                  {mandant ? (
                    <Button variant="link" asChild>
                      <Link href={mandantHref(mandant.id)}>{`Ouvrir ${mandant.name}`}</Link>
                    </Button>
                  ) : null}
                </div>
              </SectionCard>
              <SectionCard title="Documents" action={<Button variant="link" onClick={() => { setTab("documents"); }}>{`Tout voir, ${String(documents.length)}`}</Button>}>
                <DocumentList items={documents} limit={3} />
              </SectionCard>
            </div>
          </div>
        </TabPanel>

        <TabPanel value="echeances">
          <SectionCard title="Échéances">
            {schedule.length === 0 ? (
              <p className="py-2 text-body text-fg-subtle">Aucune échéance appelée pour le moment.</p>
            ) : (
              <Table aria-label="Échéances du bail">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Échéance</TableHeaderCell>
                    <TableHeaderCell>Payée le</TableHeaderCell>
                    <TableHeaderCell>Mode</TableHeaderCell>
                    <TableHeaderCell numeric>Appelé</TableHeaderCell>
                    <TableHeaderCell numeric>Encaissé</TableHeaderCell>
                    <TableHeaderCell>État</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {schedule.map((echeance) => (
                    <TableRow key={echeance.id}>
                      <TableCell strong>{`${monthName(echeance.dueIso).replace(/^./, (letter) => letter.toUpperCase())} ${String(parseDay(echeance.dueIso).year)}`}</TableCell>
                      <TableCell>{echeance.paidIso ? formatDay(echeance.paidIso) : "—"}</TableCell>
                      <TableCell>{echeance.state === "paye" ? PAYMENT_MODE_LABELS[echeance.mode] : "—"}</TableCell>
                      <TableCell numeric>{formatEurosExact(echeance.calledMinor)}</TableCell>
                      <TableCell numeric>{formatEurosExact(echeance.collectedMinor)}</TableCell>
                      <TableCell>
                        <PillBadge pill={echeance.state === "paye" ? { tone: "success", label: "Payé" } : { tone: "danger", label: "Impayé" }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        </TabPanel>

        <TabPanel value="documents">
          <SectionCard title="Documents du bail">
            <DocumentList items={documents} />
          </SectionCard>
        </TabPanel>

        <TabPanel value="edl">
          <SectionCard title="États des lieux">
            <ListRow
              icon={ClipboardCheck}
              tone="success"
              title="État des lieux d'entrée"
              caption={`${formatDay(bail.startIso)} · 36 photos · signé par les deux parties`}
              trailing={
                <>
                  <Badge tone="success">Signé</Badge>
                  <Button variant="link" aria-label="Télécharger l'état des lieux d'entrée" onClick={() => { download("État des lieux d'entrée"); }}>
                    Télécharger
                  </Button>
                </>
              }
            />
            <ListRow
              icon={ClipboardCheck}
              tone={bail.status === "termine" ? "success" : "neutral"}
              title="État des lieux de sortie"
              caption={bail.status === "termine" ? `${formatDay(bail.endIso)} · signé par les deux parties` : `À planifier avant le ${formatDay(bail.endIso)}`}
              trailing={<Badge tone={bail.status === "termine" ? "success" : "neutral"}>{bail.status === "termine" ? "Signé" : "À venir"}</Badge>}
            />
          </SectionCard>
        </TabPanel>

        <TabPanel value="historique">
          <SectionCard title="Historique du bail">
            <EventList events={events} />
          </SectionCard>
        </TabPanel>

        <TabPanel value="sortie">
          <SectionCard title="Sortie du locataire">
            {bail.status === "termine" ? (
              <Alert tone="info" title={`Bail terminé le ${formatDay(bail.endIso)}`}>
                Le locataire a quitté le lot. Le dépôt de garantie a été restitué dans le délai légal.
              </Alert>
            ) : bail.noticeGiven ? (
              <Alert tone="warning" title={`Préavis donné, départ le ${formatDay(bail.endIso)}`}>
                {`Le dépôt de garantie de ${formatEuros(bail.depositMinor)} est restitué sous ${String(restitutionMonths)} mois si l'état des lieux de sortie est conforme.`}
              </Alert>
            ) : (
              <>
                <p className="text-body text-fg-muted">{`Aucun préavis n'a été donné. Le préavis du locataire est de ${String(noticeMonths)} mois ; il court à compter de la réception de la lettre.`}</p>
                {isCurrent ? (
                  <div>
                    <Button variant="secondary" onClick={() => { setNoticing(true); }}>
                      Enregistrer un préavis
                    </Button>
                  </div>
                ) : null}
              </>
            )}
            <KeyValueList
              columns={2}
              items={[
                { label: "Fin prévue", value: formatDay(bail.endIso) },
                { label: "Dépôt à restituer", value: formatEuros(bail.depositMinor) },
                { label: "Délai de restitution", value: `${String(restitutionMonths)} mois après la remise des clés` },
                { label: "Renouvellement", value: isCurrent ? `Au plus tard le ${formatDay(addMonths(bail.endIso, -noticeMonths))}` : "—" },
              ]}
            />
          </SectionCard>
        </TabPanel>
      </Tabs>

      {editing ? (
        <EditDialog
          open
          onOpenChange={setEditing}
          title="Modifier le bail"
          description="Le loyer et les dates se modifient par avenant."
          fields={[
            { name: "dueDay", label: "Jour d'échéance", placeholder: "5", value: String(bail.dueDay), hint: "Entre le 1er et le 28 du mois." },
            { name: "note", label: "Note interne", placeholder: "Ex. : loyer payé par virement permanent", value: bail.note ?? "" },
          ]}
          schema={conditionsSchema}
          onSubmit={async (values) => {
            await patch.mutateAsync({ kind: "bail", id: bail.id, patch: { dueDay: Number(values.dueDay), note: values.note ?? "" } });
            toast.show({ title: "Bail mis à jour", description: `Bail ${bail.number}` });
          }}
        />
      ) : null}
      {noticing ? (
        <ConfirmDialog
          open
          onOpenChange={setNoticing}
          title={`Enregistrer un préavis pour ${bail.number}`}
          description={`Le départ de ${tenant?.name ?? "le locataire"} est enregistré pour le ${formatDay(bail.endIso)}. Le lot sera proposé à la relocation.`}
          confirmLabel="Enregistrer le préavis"
          loading={patch.isPending}
          onConfirm={saveNotice}
        />
      ) : null}
    </>
  );
}
