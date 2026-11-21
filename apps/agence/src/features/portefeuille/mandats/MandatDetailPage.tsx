"use client";

import { StaffWriteButton } from "@eguardimmo/messagerie";
import { Alert, Avatar, Badge, Button, Icon, StatCard, Tab, TabList, TabPanel, Tabs, useToast } from "@eguardimmo/ui";
import { Pencil, Download, FilePlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { EditDialog } from "@/components/ui/EditDialog";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { ListRow } from "@/components/ui/ListRow";
import { NotFoundState } from "@/components/ui/NotFoundState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PillBadge } from "@/components/ui/PillBadge";
import { QueryState } from "@/components/ui/QueryState";
import { initialsOf } from "@/lib/text";
import { SectionCard } from "@/components/ui/SectionCard";
import { useDemoDownload } from "@/components/ui/useDemoDownload";
import { agenceRoutes, mandantHref, mandatAvenantHref, mandatTerminationHref } from "@/espace/routes";
import { formatDay, relativeMonths } from "@/lib/dates";
import { amountExample, currencySymbol, formatAmountInput, parseAmount } from "@/lib/currency";
import type { Currency } from "@/lib/currency";
import { formatEuros, formatEurosExact, formatRate } from "@/lib/money";
import { eventsFor, mandatDocuments, termsEvents } from "../detailItems";
import { MANDAT_STATE_PILLS, TERMS_MISSING_LABEL, UNAVAILABLE, currencyOfMandat, feeText, payoutText, plural } from "../labels";
import { useMandatDetail, usePatchEntity, usePortefeuille, usePortefeuilleAccess } from "../queries";
import { calledMinor, isOperational, mandantFigures, mandatState, nextPayoutIso, reversementsOf } from "../selectors";
import type { Portefeuille } from "../selectors";
import { DocumentList } from "../shared/DocumentList";
import { EventList } from "../shared/EventList";
import { LotsTable } from "../shared/LotsTable";
import { MandatUnitsTable } from "../shared/MandatUnitsTable";
import { ReversementList } from "../shared/ReversementList";
import { UnavailableNote } from "../shared/Unavailable";
import { amountMessage, toMinor } from "../forms";
import { EndRequestNotice } from "./EndRequestNotice";
import { MandatDocumentsPanel } from "./MandatDocumentsPanel";
import { MandatMenu } from "./MandatMenu";
import { MandatUnitsPanel } from "./MandatUnitsPanel";
import { RenewMandatDialog } from "./RenewMandatDialog";

const makeConditionsSchema = (currency: Currency) =>
  z.object({
    payoutDay: z.string().regex(/^(?:[1-9]|1\d|2[0-8])$/, "Indiquez un jour entre 1 et 28, par exemple 5."),
    worksLimit: z.string().trim().refine((value) => parseAmount(value, currency) !== null, amountMessage(currency)),
  });

type TabValue = "resume" | "biens" | "reversements" | "documents" | "historique";

const POWERS = [
  { title: "Encaisser les loyers et charges", detail: "Quittances et avis d'échéance" },
  { title: "Relancer les impayés", detail: "Hors procédure judiciaire" },
];

export function MandatDetailPage({ id }: { id: string }) {
  const query = usePortefeuille();
  return (
    <QueryState query={query} label="Le mandat">
      {(index) => <MandatDetail index={index} id={id} />}
    </QueryState>
  );
}

function MandatDetail({ index, id }: { index: Portefeuille; id: string }) {
  const listed = index.mandat(id);
  const detail = useMandatDetail(id).data;
  const mandat = listed && detail ? { ...listed, ...detail } : listed;
  const { canWrite } = usePortefeuilleAccess();
  const api = index.isApi;
  const router = useRouter();
  const [tab, setTab] = useState<TabValue>("resume");
  const [editing, setEditing] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const patch = usePatchEntity();
  const toast = useToast();
  const download = useDemoDownload();
  if (!mandat) {
    return <NotFoundState title="Mandat introuvable" description={`Aucun mandat ne porte l'identifiant « ${id} ».`} backHref={agenceRoutes.mandats} backLabel="Retour aux mandats" />;
  }

  const { data } = index;
  const currency = currencyOfMandat(mandat);
  const mandant = index.mandant(mandat.mandantId);
  const biens = index.biensOfMandat(mandat.id);
  const state = mandatState(mandat, data.todayIso);
  const documents = mandatDocuments(mandat);
  const events = api ? termsEvents(mandat) : eventsFor(index, "mandat", mandat.id);
  const lots = index.lotCount(mandat);
  const reversements = mandant ? reversementsOf(index, mandant.id) : [];
  const figures = mandant ? mandantFigures(index, mandant.id) : undefined;
  const bauxEnCours = biens.flatMap((bien) => index.currentBail(bien.id) ?? []);
  const calledTotal = bauxEnCours.reduce((sum, bail) => sum + calledMinor(bail), 0);
  const unpaid = bauxEnCours.find((bail) => bail.overdueSinceIso);
  const legalName = mandant ? (mandant.legal === "Particulier" ? mandant.name : `${mandant.name}, ${mandant.legal}`) : "Mandant inconnu";
  const startEdit = () => {
    if (api && mandat.status !== "brouillon") router.push(mandatAvenantHref(mandat.id));
    else setEditing(true);
  };
  const canTerminate = canWrite && isOperational(state) && state !== "resilie" && state !== "suspendu";

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Mandats", href: agenceRoutes.mandats }, { label: mandat.number }]}
        title={`Mandat ${mandat.number}`}
        badges={<PillBadge pill={MANDAT_STATE_PILLS[state]} />}
        description={`${legalName} · ${plural(lots, "lot", "lots")} · du ${formatDay(mandat.startIso)} au ${formatDay(mandat.endIso)}`}
        actions={
          <>
            {api && mandant ? (
              <StaffWriteButton
                variant="secondary"
                label="Écrire au mandant"
                target={{ kind: "owner", partyId: mandant.id, partyName: mandant.name, links: [{ id: mandat.id, label: `Mandat ${mandat.number}` }], defaultLinkId: mandat.id }}
              />
            ) : null}
            {canWrite ? (
              <Button variant="secondary" onClick={startEdit}>
                <Icon icon={Pencil} />
                Modifier
              </Button>
            ) : null}
            {api ? null : (
              <Button variant="secondary" onClick={() => { download(`Mandat ${mandat.number}`); }}>
                <Icon icon={Download} />
                Télécharger le mandat
              </Button>
            )}
            {canWrite && !mandat.archived ? (
              <Button asChild>
                <Link href={mandatAvenantHref(mandat.id)}>
                  <Icon icon={FilePlus} />
                  Ajouter un avenant
                </Link>
              </Button>
            ) : null}
            <MandatMenu
              mandat={mandat}
              state={state}
              todayIso={data.todayIso}
              label={`Autres actions pour le mandat ${mandat.number}`}
              items={[
                ...(canWrite && state === "a_renouveler" ? [{ id: "renouveler", label: "Renouveler le mandat", onSelect: () => { setRenewing(true); } }] : []),
                ...(canTerminate ? [{ id: "fin", label: "Mettre fin au mandat", href: mandatTerminationHref(mandat.id), tone: "danger" as const }] : []),
                { id: "historique", label: "Voir l'historique", onSelect: () => { setTab("historique"); } },
              ]}
            />
          </>
        }
      />

      {mandat.termination ? (
        <Alert tone="warning" title={`Fin de mandat programmée le ${formatDay(mandat.termination.effectIso)}`}>
          {mandat.termination.note || "Le mandat est résilié. Les comptes seront soldés avant la date d'effet."}
        </Alert>
      ) : null}

      {api && detail !== undefined ? <EndRequestNotice mandateId={mandat.id} mandateNumber={mandat.number} /> : null}

      <Tabs value={tab} defaultValue="resume" onValueChange={(next) => { setTab(next as TabValue); }}>
        <TabList aria-label="Sections du mandat">
          <Tab value="resume">Résumé</Tab>
          <Tab value="biens" count={lots}>Biens</Tab>
          <Tab value="reversements" {...(api ? {} : { count: reversements.length })}>Reversements</Tab>
          <Tab value="documents" {...(api ? {} : { count: documents.length })}>Documents</Tab>
          <Tab value="historique" count={events.length}>Historique</Tab>
        </TabList>

        <TabPanel value="resume" className="flex min-w-0 flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Honoraires" value={api ? feeText(mandat, false) : formatRate(mandat.feeBasisPoints)}>
              <span className="text-caption text-fg-subtle">{api ? (mandat.flatFeeMinor === undefined ? "des loyers encaissés" : "par mois") : "TTC des loyers encaissés"}</span>
            </StatCard>
            <StatCard label="Reversement" value={payoutText(mandat)}>
              <span className="text-caption text-fg-subtle">{api ? "de chaque mois" : "de chaque mois, par virement"}</span>
            </StatCard>
            <StatCard label="Échéance" value={formatDay(mandat.endIso)}>
              <span className="text-caption text-fg-subtle">{relativeMonths(data.todayIso, mandat.endIso)}</span>
            </StatCard>
            <StatCard label="Loyers gérés" value={api ? UNAVAILABLE : `${formatEuros(calledTotal)} par mois`}>
              <span className="text-caption text-fg-subtle">{api ? "les baux ne sont pas encore reliés" : "charges comprises"}</span>
            </StatCard>
          </div>

          <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-3">
              <SectionCard title="Conditions du mandat" {...(canWrite ? { action: <Button variant="link" onClick={startEdit}>Modifier</Button> } : {})}>
                <KeyValueList
                  columns={2}
                  items={[
                    { label: "Mandataire", value: data.agencyName },
                    { label: "Mandant", value: legalName },
                    { label: "Prise d'effet", value: formatDay(mandat.startIso) },
                    { label: "Échéance", value: formatDay(mandat.endIso) },
                    { label: "Reconduction", value: mandat.renewal === "tacite" ? "Tacite reconduction" : "Aucune, à renouveler" },
                    ...(api
                      ? [
                          { label: "Type de mandat", value: mandat.typeLabel ?? "—" },
                          { label: "Honoraires", value: mandat.flatFeeMinor === undefined && mandat.termsMissing !== true ? `${feeText(mandat, false)} des loyers encaissés` : feeText(mandat, false) },
                          { label: "Reversement", value: payoutText(mandat, " de chaque mois") },
                          { label: "Préavis de résiliation", value: mandat.noticeMonths === undefined ? "—" : plural(mandat.noticeMonths, "mois", "mois") },
                          { label: "Signature", value: mandat.signedOnIso ? `Signé le ${formatDay(mandat.signedOnIso)}` : "Non signé" },
                          { label: "Compte de reversement", value: UNAVAILABLE },
                          { label: "Quittances", value: UNAVAILABLE },
                          { label: "Garantie financière", value: UNAVAILABLE },
                        ]
                      : [
                          { label: "Honoraires", value: `${formatRate(mandat.feeBasisPoints)} TTC, loyers encaissés` },
                          { label: "Reversement", value: `Le ${String(mandat.payoutDay)}, compte •••• ${mandant?.ibanLast4 ?? "—"}` },
                        ]),
                    { label: "Travaux sans accord", value: mandat.termsMissing === true ? TERMS_MISSING_LABEL : `Jusqu'à ${formatEuros(mandat.worksLimitMinor, currency)}` },
                    ...(api
                      ? []
                      : [
                          { label: "Quittances", value: "Émises par l'agence" },
                          { label: "Garantie financière", value: `Valable jusqu'au ${mandat.guaranteeUntilIso ? formatDay(mandat.guaranteeUntilIso) : "—"}` },
                        ]),
                  ]}
                />
              </SectionCard>
              <SectionCard title="Biens du mandat" action={<Button variant="link" onClick={() => { setTab("biens"); }}>{`Tout voir, ${String(lots)}`}</Button>}>
                {api ? <MandatUnitsTable units={mandat.units ?? []} label="Biens du mandat" /> : <LotsTable index={index} biens={biens} label="Biens du mandat" />}
              </SectionCard>
              <SectionCard title="Historique" action={<Button variant="link" onClick={() => { setTab("historique"); }}>{`Tout voir, ${String(events.length)}`}</Button>}>
                <EventList events={events} limit={3} />
              </SectionCard>
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              {mandant ? (
                <SectionCard title="Mandant" action={<Button variant="link" asChild><Link href={mandantHref(mandant.id)}>Ouvrir</Link></Button>}>
                  <div className="flex items-center gap-2">
                    <Avatar initials={initialsOf(mandant.name)} size="md" />
                    <div className="flex min-w-0 flex-col">
                      <strong className="truncate text-body-strong text-fg">{mandant.name}</strong>
                      <span className="truncate text-caption text-fg-subtle">{api ? mandant.legal : `${mandant.legal} · espace propriétaire ${mandant.ownerSpaceActive ? "actif" : "non activé"}`}</span>
                    </div>
                  </div>
                  {figures && figures.payoutMinor > 0 && mandat.termsMissing !== true ? (
                    <ListRow
                      title="Reversement du mois"
                      caption={`${formatEurosExact(figures.payoutMinor)} le ${formatDay(nextPayoutIso(data.todayIso, mandat.payoutDay))}`}
                      trailing={<Badge tone="info">À reverser</Badge>}
                    />
                  ) : null}
                  {unpaid ? <p className="text-caption text-fg-danger">Un impayé est en cours sur ce mandat.</p> : null}
                </SectionCard>
              ) : null}
              <SectionCard title="Pouvoirs de l'agence">
                {api ? (
                  <UnavailableNote what="le détail des pouvoirs n'est pas porté par le mandat" />
                ) : (
                  [...POWERS, { title: "Commander des travaux urgents", detail: `Jusqu'à ${formatEuros(mandat.worksLimitMinor, currency)} sans accord` }].map((power) => (
                    <ListRow key={power.title} title={power.title} caption={power.detail} />
                  ))
                )}
              </SectionCard>
              <SectionCard title="Documents" {...(api ? {} : { action: <Button variant="link" onClick={() => { setTab("documents"); }}>{`Tout voir, ${String(documents.length)}`}</Button> })}>
                {api ? <Button variant="link" onClick={() => { setTab("documents"); }}>Voir les documents partagés avec le mandant</Button> : <DocumentList items={documents} limit={2} />}
              </SectionCard>
            </div>
          </div>
        </TabPanel>

        <TabPanel value="biens">
          <SectionCard title="Biens du mandat">
            {api ? <MandatUnitsPanel mandat={mandat} state={state} /> : <LotsTable index={index} biens={biens} label="Biens du mandat" />}
          </SectionCard>
        </TabPanel>
        <TabPanel value="reversements">
          <SectionCard title="Reversements exécutés">
            {api ? <UnavailableNote what="les reversements" /> : <ReversementList lines={reversements} />}
          </SectionCard>
        </TabPanel>
        <TabPanel value="documents">
          <SectionCard title="Documents">
            {api ? <MandatDocumentsPanel mandat={mandat} canWrite={canWrite} /> : <DocumentList items={documents} />}
          </SectionCard>
        </TabPanel>
        <TabPanel value="historique">
          <SectionCard title="Historique">
            <EventList events={events} />
          </SectionCard>
        </TabPanel>
      </Tabs>

      {editing && canWrite ? (
        <EditDialog
          open
          onOpenChange={setEditing}
          title="Modifier les conditions"
          description={api ? "Ce mandat est un brouillon : ses conditions se modifient directement. Une fois activé, elles passent par un avenant signé." : "Les honoraires et les dates se modifient par avenant."}
          fields={[
            { name: "payoutDay", label: "Jour de reversement", placeholder: "5", value: String(mandat.payoutDay), hint: "Entre le 1er et le 28 du mois." },
            { name: "worksLimit", label: `Travaux sans accord, jusqu'à (${currencySymbol(currency)})`, placeholder: amountExample(currency), value: formatAmountInput(mandat.worksLimitMinor, currency) },
          ]}
          schema={makeConditionsSchema(currency)}
          onSubmit={async (values) => {
            await patch.mutateAsync({
              kind: "mandat",
              id: mandat.id,
              patch: { payoutDay: Number(values.payoutDay), worksLimitMinor: toMinor(values.worksLimit ?? "0", currency) },
            });
            toast.show({ title: "Conditions mises à jour", description: `Mandat ${mandat.number}` });
          }}
        />
      ) : null}
      {renewing ? <RenewMandatDialog mandat={mandat} onOpenChange={setRenewing} /> : null}
    </>
  );
}
