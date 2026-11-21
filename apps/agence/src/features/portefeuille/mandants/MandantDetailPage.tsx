"use client";

import { StaffWriteButton } from "@eguardimmo/messagerie";
import { Badge, Button, Icon, StatCard, Tab, TabList, TabPanel, Tabs, useToast } from "@eguardimmo/ui";
import { CircleAlert, MessageSquare, Pencil, Wallet } from "lucide-react";
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
import { agenceRoutes, locataireHref, mandatHref } from "@/espace/routes";
import { formatDay, monthName } from "@/lib/dates";
import { formatEurosExact, formatRate } from "@/lib/money";
import { mandantDocuments } from "../detailItems";
import { MANDAT_STATE_PILLS, feeText, payoutText, plural } from "../labels";
import { usePatchEntity, usePortefeuille, usePortefeuilleAccess } from "../queries";
import { balanceMinor, mandantFigures, mandatState, nextPayoutIso, overdueDays, reversementsOf } from "../selectors";
import type { Portefeuille } from "../selectors";
import { DocumentList } from "../shared/DocumentList";
import { LotsTable } from "../shared/LotsTable";
import { MandatUnitsTable } from "../shared/MandatUnitsTable";
import { ReversementList } from "../shared/ReversementList";
import { UnavailableNote } from "../shared/Unavailable";
import { OwnerAccessSection } from "./ownerAccess/OwnerAccessSection";

const contactSchema = z.object({
  email: z.email("Saisissez une adresse e-mail valide, par exemple marc.chevalier@example.com."),
  address: z.string().trim().min(1, "Indiquez l'adresse, par exemple 4 quai Saint-Antoine, Lyon."),
});

type TabValue = "resume" | "biens" | "mandats" | "reversements" | "documents";

export function MandantDetailPage({ id }: { id: string }) {
  const query = usePortefeuille();
  return (
    <QueryState query={query} label="La fiche du mandant">
      {(index) => <MandantDetail index={index} id={id} />}
    </QueryState>
  );
}

function MandantDetail({ index, id }: { index: Portefeuille; id: string }) {
  const mandant = index.mandant(id);
  const [tab, setTab] = useState<TabValue>("resume");
  const [editing, setEditing] = useState(false);
  const patch = usePatchEntity();
  const toast = useToast();
  const { canWrite } = usePortefeuilleAccess();
  if (!mandant) {
    return <NotFoundState title="Mandant introuvable" description={`Aucun mandant ne porte l'identifiant « ${id} ».`} backHref={agenceRoutes.mandants} backLabel="Retour aux mandants" />;
  }

  const { data } = index;
  const api = index.isApi;
  const mandat = index.activeMandat(id);
  const mandats = index.mandatsOf(id);
  const biens = index.biensOfMandant(id);
  const figures = mandantFigures(index, id);
  const lots = api ? (mandat ? index.lotCount(mandat) : 0) : figures.lots;
  const reversements = reversementsOf(index, id);
  const documents = mandantDocuments(mandant, mandat);
  const overdue = biens.flatMap((bien) => index.currentBail(bien.id) ?? []).filter((bail) => bail.overdueSinceIso);
  const month = monthName(data.todayIso);
  const state = mandat ? mandatState(mandat, data.todayIso) : "termine";
  const payoutDate = mandat && mandat.termsMissing !== true ? formatDay(nextPayoutIso(data.todayIso, mandat.payoutDay)) : "—";

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Mandants", href: agenceRoutes.mandants }, { label: mandant.name }]}
        title={mandant.name}
        badges={
          <>
            <PillBadge pill={state === "termine" ? { tone: "neutral", label: "Sans mandat actif" } : { ...MANDAT_STATE_PILLS[state], label: state === "actif" ? "Mandat actif" : MANDAT_STATE_PILLS[state].label }} />
            {overdue.length > 0 ? <Badge tone="danger">{plural(overdue.length, "impayé", "impayés")}</Badge> : null}
          </>
        }
        description={api || !mandant.sinceIso ? `${mandant.legal} · ${plural(lots, "lot", "lots")}` : `${mandant.legal} · Mandant depuis le ${formatDay(mandant.sinceIso)} · ${plural(lots, "lot", "lots")}`}
        actions={
          <>
            {api ? (
              <StaffWriteButton
                variant="secondary"
                target={{
                  kind: "owner",
                  partyId: mandant.id,
                  partyName: mandant.name,
                  links: mandats.map((entry) => ({ id: entry.id, label: `Mandat ${entry.number}` })),
                  ...(mandat ? { defaultLinkId: mandat.id } : {}),
                }}
              />
            ) : (
              <Button variant="secondary" asChild>
                <Link href={agenceRoutes.messageNew}>
                  <Icon icon={MessageSquare} />
                  Écrire
                </Link>
              </Button>
            )}
            {api ? null : (
              <>
                <Button variant="secondary" onClick={() => { setEditing(true); }}>
                  <Icon icon={Pencil} />
                  Modifier
                </Button>
                <Button asChild>
                  <Link href={agenceRoutes.reversementLot}>
                    <Icon icon={Wallet} />
                    Préparer le reversement
                  </Link>
                </Button>
              </>
            )}
            <RowMenu
              label={`Autres actions pour ${mandant.name}`}
              items={[
                ...(canWrite ? [{ id: "mandat", label: "Nouveau mandat", href: `${agenceRoutes.mandatNew}?mandant=${mandant.id}` }] : []),
                { id: "mandats", label: "Voir les mandats", onSelect: () => { setTab("mandats"); } },
              ]}
            />
          </>
        }
      />

      <Tabs value={tab} defaultValue="resume" onValueChange={(next) => { setTab(next as TabValue); }}>
        <TabList aria-label="Sections de la fiche mandant">
          <Tab value="resume">Résumé</Tab>
          <Tab value="biens" count={api ? lots : biens.length}>Biens</Tab>
          <Tab value="mandats" count={mandats.length}>Mandats</Tab>
          <Tab value="reversements" {...(api ? {} : { count: reversements.length })}>Reversements</Tab>
          <Tab value="documents" {...(api ? {} : { count: documents.length })}>Documents</Tab>
        </TabList>

        <TabPanel value="resume" className="flex min-w-0 flex-col gap-3">
          {api ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <StatCard label="Mandat en cours" value={mandat ? mandat.number : "Aucun"}>
                  <span className="text-caption text-fg-subtle">{mandat ? `échéance le ${formatDay(mandat.endIso)}` : "aucun mandat en vigueur"}</span>
                </StatCard>
                <StatCard label="Lots sous mandat" value={lots}>
                  <span className="text-caption text-fg-subtle">lots couverts aujourd&apos;hui</span>
                </StatCard>
              </div>
              <UnavailableNote what="loyers encaissés, honoraires, reversements et impayés du mois (les baux ne sont pas encore reliés)" />
            </div>
          ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label={`Loyers encaissés, ${month}`} value={formatEurosExact(figures.collectedMinor)}>
              <span className="text-caption text-fg-subtle">{`sur ${formatEurosExact(figures.calledMinor)} appelés`}</span>
            </StatCard>
            <StatCard label="Honoraires du mois" value={formatEurosExact(figures.feeMinor)}>
              <span className="text-caption text-fg-subtle">{`${formatRate(mandat?.feeBasisPoints ?? 0)} TTC des loyers encaissés`}</span>
            </StatCard>
            <StatCard label={`À reverser le ${payoutDate}`} value={formatEurosExact(figures.payoutMinor)}>
              <span className="text-caption text-fg-subtle">après honoraires</span>
            </StatCard>
            <StatCard label="Impayé" value={formatEurosExact(overdue.reduce((sum, bail) => sum - balanceMinor(bail), 0))} tone={overdue.length > 0 ? "danger" : "default"}>
              <span className="text-caption text-fg-subtle">
                {overdue.length === 0 ? "aucun loyer en retard" : overdue.map((bail) => `${index.bien(bail.bienId)?.name ?? "Lot"}, ${plural(overdueDays(bail, data.todayIso), "jour", "jours")}`).join(" · ")}
              </span>
            </StatCard>
          </div>
          )}

          <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-3">
              <SectionCard title="Biens sous mandat" action={<Button variant="link" onClick={() => { setTab("biens"); }}>{`Tout voir, ${String(biens.length)}`}</Button>}>
                {api ? <MandatUnitsTable units={mandat?.units?.filter((unit) => unit.endIso === null) ?? []} label="Biens sous mandat du mandant" /> : <LotsTable index={index} biens={biens} label="Biens sous mandat du mandant" />}
              </SectionCard>
              <SectionCard title="Derniers reversements" {...(api ? {} : { action: <Button variant="link" onClick={() => { setTab("reversements"); }}>{`Tout voir, ${String(reversements.length)}`}</Button> })}>
                {api ? <UnavailableNote what="les reversements" /> : <ReversementList lines={reversements} limit={3} />}
              </SectionCard>
              <SectionCard title="Documents" {...(api ? {} : { action: <Button variant="link" onClick={() => { setTab("documents"); }}>{`Tout voir, ${String(documents.length)}`}</Button> })}>
                {api ? <UnavailableNote what="les documents du mandant" /> : <DocumentList items={documents} limit={2} />}
              </SectionCard>
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              {mandat ? (
                <SectionCard title="Mandat" action={<Button variant="link" asChild><Link href={mandatHref(mandat.id)}>Ouvrir</Link></Button>}>
                  <KeyValueList
                    items={[
                      { label: "Numéro", value: mandat.number },
                      { label: "Honoraires", value: api || mandat.termsMissing === true ? feeText(mandat, false) : `${feeText(mandat, true)} des loyers` },
                      { label: "Reversement", value: payoutText(mandat, " de chaque mois") },
                      { label: "Prise d'effet", value: formatDay(mandat.startIso) },
                      { label: "Échéance", value: formatDay(mandat.endIso) },
                    ]}
                  />
                </SectionCard>
              ) : null}
              <SectionCard title="Coordonnées" {...(api ? {} : { action: <Button variant="link" onClick={() => { setEditing(true); }}>Modifier</Button> })}>
                {api ? (
                  <UnavailableNote what="e-mail, mobile, adresse, IBAN et accès ne sont pas fournis par l'API des mandats" />
                ) : (
                  <KeyValueList
                    items={[
                      { label: "E-mail", value: mandant.email ?? "—" },
                      { label: "Mobile", value: mandant.phoneMasked ?? "—" },
                      { label: "Adresse", value: mandant.address ?? "—" },
                      { label: "Reversement", value: `IBAN •••• ${mandant.ibanLast4 ?? "—"}` },
                      { label: "Accès", value: mandant.ownerSpaceActive ? "Espace propriétaire actif" : "Espace propriétaire non activé" },
                    ]}
                  />
                )}
              </SectionCard>
              {api ? <OwnerAccessSection partyId={mandant.id} mandantName={mandant.name} mandantKind={mandant.type === "societe" ? "societe" : "particulier"} canWrite={canWrite} /> : null}
              {overdue.length > 0 ? (
                <SectionCard title="Impayé en cours" action={<Button variant="link" asChild><Link href={agenceRoutes.impayes}>{`Tout voir, ${String(overdue.length)}`}</Link></Button>}>
                  {overdue.map((bail) => (
                    <ListRow
                      key={bail.id}
                      icon={CircleAlert}
                      tone="danger"
                      title={
                        <Link href={locataireHref(bail.locataireId)} className="hover:underline">{`${index.bien(bail.bienId)?.name ?? "Lot"}, ${index.locataire(bail.locataireId)?.name ?? "Locataire"}`}</Link>
                      }
                      caption={`Échéance du ${formatDay(bail.overdueSinceIso ?? data.todayIso)}`}
                      trailing={<strong className="tabular-nums text-fg">{formatEurosExact(-balanceMinor(bail))}</strong>}
                    />
                  ))}
                </SectionCard>
              ) : null}
            </div>
          </div>
        </TabPanel>

        <TabPanel value="biens">
          <SectionCard title="Biens sous mandat">
            {api ? <MandatUnitsTable units={mandat?.units?.filter((unit) => unit.endIso === null) ?? []} label="Biens sous mandat du mandant" /> : <LotsTable index={index} biens={biens} label="Biens sous mandat du mandant" />}
            {biens.length > 0 ? <p className="text-caption text-fg-subtle">Ouvrez un lot depuis son nom pour consulter sa fiche ({biens.map((bien) => bien.name).join(", ")}).</p> : null}
          </SectionCard>
        </TabPanel>

        <TabPanel value="mandats">
          <SectionCard title="Mandats">
            {mandats.map((item) => (
              <ListRow
                key={item.id}
                title={<Link href={mandatHref(item.id)} className="hover:underline">{`Mandat ${item.number}`}</Link>}
                caption={`Du ${formatDay(item.startIso)} au ${formatDay(item.endIso)} · ${plural(index.lotCount(item), "lot", "lots")}`}
                trailing={<PillBadge pill={MANDAT_STATE_PILLS[mandatState(item, data.todayIso)]} />}
              />
            ))}
          </SectionCard>
        </TabPanel>

        <TabPanel value="reversements">
          <SectionCard title="Reversements exécutés">
            {api ? <UnavailableNote what="les reversements" /> : <ReversementList lines={reversements} />}
          </SectionCard>
        </TabPanel>

        <TabPanel value="documents">
          <SectionCard title="Documents">
            {api ? <UnavailableNote what="les documents du mandant" /> : <DocumentList items={documents} />}
          </SectionCard>
        </TabPanel>
      </Tabs>

      {editing && !api ? (
        <EditDialog
          open
          onOpenChange={setEditing}
          title="Modifier les coordonnées"
          description="Le téléphone et l'IBAN se modifient depuis l'espace sécurisé du mandant."
          fields={[
            { name: "email", label: "E-mail", placeholder: "marc.chevalier@example.com", value: mandant.email ?? "" },
            { name: "address", label: "Adresse", placeholder: "4 quai Saint-Antoine, Lyon", value: mandant.address ?? "" },
          ]}
          schema={contactSchema}
          onSubmit={async (values) => {
            await patch.mutateAsync({ kind: "mandant", id: mandant.id, patch: values });
            toast.show({ title: "Coordonnées mises à jour", description: mandant.name });
          }}
        />
      ) : null}
    </>
  );
}
