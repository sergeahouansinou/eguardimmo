"use client";

import {
  Badge,
  Button,
  Icon,
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
import { Home, MessageSquare, BellRing, Banknote } from "lucide-react";
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
import { agenceRoutes, bailHref, mandantHref } from "@/espace/routes";
import { formatDay, ofMonth, relativeMonths } from "@/lib/dates";
import { formatEuros, formatEurosExact, formatEurosSigned } from "@/lib/money";
import { eventsFor, locataireDocuments } from "../detailItems";
import { bailPill, locatairePill, plural } from "../labels";
import { usePatchEntity, usePortefeuille } from "../queries";
import { balanceMinor, buildSchedule, calledMinor } from "../selectors";
import type { Portefeuille } from "../selectors";
import { DocumentList } from "../shared/DocumentList";
import { EventList } from "../shared/EventList";

const contactSchema = z.object({
  email: z.email("Saisissez une adresse e-mail valide, par exemple anais.roux@example.com."),
});

type TabValue = "apercu" | "baux" | "paiements" | "documents" | "messages";

const MESSAGE_PILLS = {
  a_repondre: { tone: "warning", label: "À répondre" },
  envoye: { tone: "neutral", label: "Envoyé" },
  lu: { tone: "neutral", label: "Lu" },
} as const;

export function LocataireDetailPage({ id }: { id: string }) {
  const query = usePortefeuille();
  return (
    <QueryState query={query} label="La fiche du locataire">
      {(index) => <LocataireDetail index={index} id={id} />}
    </QueryState>
  );
}

function LocataireDetail({ index, id }: { index: Portefeuille; id: string }) {
  const tenant = index.locataire(id);
  const [tab, setTab] = useState<TabValue>("apercu");
  const [editing, setEditing] = useState(false);
  const patch = usePatchEntity();
  const toast = useToast();
  if (!tenant) {
    return <NotFoundState title="Locataire introuvable" description={`Aucun locataire ne porte l'identifiant « ${id} ».`} backHref={agenceRoutes.locataires} backLabel="Retour aux locataires" />;
  }

  const { data } = index;
  const baux = data.baux.filter((bail) => bail.locataireId === tenant.id && bail.status !== "brouillon").sort((a, b) => (a.startIso < b.startIso ? 1 : -1));
  const bail = index.currentBailOf(tenant.id) ?? baux[0];
  const bien = bail ? index.bien(bail.bienId) : undefined;
  const mandant = bien ? index.mandantOfBien(bien) : undefined;
  const schedule = bail ? buildSchedule(bail, data.todayIso) : [];
  const paid = schedule.filter((echeance) => echeance.state === "paye");
  const unpaid = schedule.filter((echeance) => echeance.state === "impaye");
  const documents = locataireDocuments(index, tenant.id);
  const events = eventsFor(index, "locataire", tenant.id);
  const messages = data.messages.filter((message) => message.locataireId === tenant.id);
  const balance = bail?.status === "en_cours" ? balanceMinor(bail) : 0;
  const punctuality = schedule.length === 0 ? undefined : Math.round((paid.length / schedule.length) * 100);
  const pill = tenant.archived ? { tone: "neutral" as const, label: "Archivé" } : locatairePill(bail, data.todayIso);
  const address = bien ? `${bien.name}, ${bien.street}` : "—";

  const paymentsTable = (limit?: number) => {
    const shown = limit === undefined ? schedule : schedule.slice(0, limit);
    if (shown.length === 0) return <p className="py-2 text-body text-fg-subtle">Aucune échéance enregistrée.</p>;
    return (
      <Table aria-label="Paiements du locataire">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Date</TableHeaderCell>
            <TableHeaderCell>Libellé</TableHeaderCell>
            <TableHeaderCell numeric>Montant</TableHeaderCell>
            <TableHeaderCell>État</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {shown.map((echeance) => (
            <TableRow key={echeance.id}>
              <TableCell>{formatDay(echeance.paidIso ?? echeance.dueIso)}</TableCell>
              <TableCell>{`Échéance ${ofMonth(echeance.dueIso)}`}</TableCell>
              <TableCell numeric>{echeance.state === "paye" ? formatEurosExact(echeance.collectedMinor) : "—"}</TableCell>
              <TableCell>
                <PillBadge pill={echeance.state === "paye" ? { tone: "success", label: "Payé" } : { tone: "danger", label: "Impayé" }} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const messageList = (limit?: number) => {
    const shown = limit === undefined ? messages : messages.slice(0, limit);
    if (shown.length === 0) return <p className="py-2 text-body text-fg-subtle">Aucun message échangé.</p>;
    return (
      <div>
        {shown.map((message) => (
          <ListRow
            key={message.id}
            icon={MessageSquare}
            tone="info"
            title={<Link href={agenceRoutes.messages} className="hover:underline">{message.title}</Link>}
            caption={`${formatDay(message.dateIso)} · ${message.from}`}
            trailing={<PillBadge pill={MESSAGE_PILLS[message.state]} />}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Locataires", href: agenceRoutes.locataires }, { label: tenant.name }]}
        title={tenant.name}
        badges={
          <>
            <PillBadge pill={pill.label.startsWith("Impayé") ? { tone: "danger", label: "Loyer en retard" } : pill} />
            {tenant.spaceActive ? <Badge tone="success">Espace locataire actif</Badge> : <Badge>Espace locataire non activé</Badge>}
          </>
        }
        description={`Particulier · ${bail ? `${tenant.archived ? "Parti le" : "Locataire depuis le"} ${formatDay(tenant.archived ? bail.endIso : bail.startIso)}` : "Aucun bail"} · ${bien ? `${bien.name}, ${bien.street}, ${bien.postalCode} ${bien.city}` : "aucun lot"}`}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href={agenceRoutes.messageNew}>
                <Icon icon={MessageSquare} />
                Écrire
              </Link>
            </Button>
            {balance < 0 ? (
              <Button variant="secondary" asChild>
                <Link href={agenceRoutes.impayes}>
                  <Icon icon={BellRing} />
                  Relancer
                </Link>
              </Button>
            ) : null}
            {!tenant.archived && bail ? (
              <Button asChild>
                <Link href={agenceRoutes.encaissementNew}>
                  <Icon icon={Banknote} />
                  Enregistrer un paiement
                </Link>
              </Button>
            ) : null}
            <RowMenu
              label={`Autres actions pour ${tenant.name}`}
              items={[
                { id: "modifier", label: "Modifier les coordonnées", onSelect: () => { setEditing(true); } },
                ...(bail ? [{ id: "bail", label: "Voir le bail", href: bailHref(bail.id) }] : []),
              ]}
            />
          </>
        }
      />

      <Tabs value={tab} defaultValue="apercu" onValueChange={(next) => { setTab(next as TabValue); }}>
        <TabList aria-label="Sections de la fiche locataire">
          <Tab value="apercu">Vue d&apos;ensemble</Tab>
          <Tab value="baux" count={baux.length}>Baux</Tab>
          <Tab value="paiements" count={schedule.length}>Paiements</Tab>
          <Tab value="documents" count={documents.length}>Documents</Tab>
          <Tab value="messages" count={messages.length}>Messages</Tab>
        </TabList>

        <TabPanel value="apercu" className="flex min-w-0 flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Solde du compte" value={formatEurosSigned(balance).replace("-", "−")} tone={balance < 0 ? "danger" : "default"}>
              <span className="text-caption text-fg-subtle">{unpaid[0] ? `Échéance du ${formatDay(unpaid.at(-1)?.dueIso ?? data.todayIso)}` : "Aucun retard"}</span>
            </StatCard>
            <StatCard label="Loyer charges comprises" value={bail ? `${formatEuros(calledMinor(bail))} par mois` : "—"}>
              <span className="text-caption text-fg-subtle">{bail ? `${formatEuros(bail.rentMinor)} de loyer et ${formatEuros(bail.chargesMinor)} de provisions` : "aucun bail"}</span>
            </StatCard>
            <StatCard label="Paiements à l'heure" value={punctuality === undefined ? "—" : `${String(punctuality)} %`}>
              <span className="text-caption text-fg-subtle">{`${String(paid.length)} échéances sur ${String(schedule.length)}`}</span>
            </StatCard>
            <StatCard label="Fin du bail" value={bail ? formatDay(bail.endIso) : "—"}>
              <span className="text-caption text-fg-subtle">{bail?.status === "en_cours" ? relativeMonths(data.todayIso, bail.endIso) : "bail terminé"}</span>
            </StatCard>
          </div>

          <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-3">
              <SectionCard
                title="Derniers paiements"
                action={
                  <span className="flex items-center gap-2">
                    {balance < 0 ? (
                      <Button variant="secondary" size="sm" asChild>
                        <Link href={agenceRoutes.encaissementNew}>Encaisser</Link>
                      </Button>
                    ) : null}
                    <Button variant="link" onClick={() => { setTab("paiements"); }}>{`Tout voir, ${String(schedule.length)}`}</Button>
                  </span>
                }
              >
                <p className="text-caption text-fg-subtle">{`${plural(schedule.length, "échéance", "échéances")} · ${plural(paid.length, "payée", "payées")}${unpaid.length > 0 ? `, ${plural(unpaid.length, "impayée", "impayées")}, ${formatEuros(-balance)}` : ""}`}</p>
                {paymentsTable(3)}
              </SectionCard>
              <SectionCard title="Dernières activités">
                <EventList events={events} limit={3} empty="Aucune activité récente." />
              </SectionCard>
              <SectionCard title="Derniers messages" action={<Button variant="link" onClick={() => { setTab("messages"); }}>{`Tout voir, ${String(messages.length)}`}</Button>}>
                {messageList(2)}
              </SectionCard>
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <SectionCard title="Coordonnées" action={<Button variant="link" onClick={() => { setEditing(true); }}>Modifier</Button>}>
                <KeyValueList
                  items={[
                    { label: "Mobile", value: tenant.phoneMasked },
                    { label: "E-mail", value: tenant.email },
                    { label: "Logement", value: address },
                    { label: "Mandant", value: mandant?.name ?? "—" },
                    { label: "Banque", value: `IBAN •••• ${tenant.bankLast4}` },
                  ]}
                />
                {mandant ? (
                  <Button variant="link" asChild>
                    <Link href={mandantHref(mandant.id)}>{`Ouvrir ${mandant.name}`}</Link>
                  </Button>
                ) : null}
              </SectionCard>
              <SectionCard title="Dossier du locataire" action={<Button variant="link" onClick={() => { setTab("documents"); }}>{`Tout voir, ${String(documents.length)}`}</Button>}>
                <DocumentList items={documents} limit={3} />
              </SectionCard>
              <SectionCard title="Bail" action={<Button variant="link" onClick={() => { setTab("baux"); }}>{`Tout voir, ${String(baux.length)}`}</Button>}>
                {bail && bien ? (
                  <ListRow
                    icon={Home}
                    tone="info"
                    title={<Link href={bailHref(bail.id)} className="hover:underline">{`${bien.name}, ${bien.street}`}</Link>}
                    caption={`${bail.furnished ? "Location meublée" : "Location vide"} · ${formatDay(bail.startIso)} au ${formatDay(bail.endIso)} · ${formatEuros(calledMinor(bail))} CC`}
                    trailing={<PillBadge pill={bailPill(bail)} />}
                  />
                ) : (
                  <p className="text-body text-fg-subtle">Aucun bail pour ce locataire.</p>
                )}
              </SectionCard>
            </div>
          </div>
        </TabPanel>

        <TabPanel value="baux">
          <SectionCard title="Baux">
            {baux.length === 0 ? <p className="py-2 text-body text-fg-subtle">Aucun bail pour ce locataire.</p> : null}
            {baux.map((item) => {
              const lot = index.bien(item.bienId);
              return (
                <ListRow
                  key={item.id}
                  icon={Home}
                  tone="info"
                  title={
                    <Link href={bailHref(item.id)} className="hover:underline">{`Bail ${item.number}`}</Link>
                  }
                  caption={`${lot ? `${lot.name}, ${lot.street} · ` : ""}${formatDay(item.startIso)} au ${formatDay(item.endIso)}`}
                  trailing={<PillBadge pill={bailPill(item)} />}
                />
              );
            })}
          </SectionCard>
        </TabPanel>
        <TabPanel value="paiements">
          <SectionCard title="Paiements">{paymentsTable()}</SectionCard>
        </TabPanel>
        <TabPanel value="documents">
          <SectionCard title="Dossier du locataire">
            <DocumentList items={documents} />
          </SectionCard>
        </TabPanel>
        <TabPanel value="messages">
          <SectionCard title="Messages">{messageList()}</SectionCard>
        </TabPanel>
      </Tabs>

      {editing ? (
        <EditDialog
          open
          onOpenChange={setEditing}
          title="Modifier les coordonnées"
          description="Le téléphone et l'IBAN se modifient depuis l'espace sécurisé du locataire."
          fields={[{ name: "email", label: "E-mail", placeholder: "anais.roux@example.com", value: tenant.email }]}
          schema={contactSchema}
          onSubmit={async (values) => {
            await patch.mutateAsync({ kind: "locataire", id: tenant.id, patch: values });
            toast.show({ title: "Coordonnées mises à jour", description: tenant.name });
          }}
        />
      ) : null}
    </>
  );
}
