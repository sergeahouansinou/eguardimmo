"use client";

import { Avatar, Badge, Button, Icon } from "@eguardimmo/ui";
import { CircleCheck, Handshake, MessageSquare, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { formatDate } from "../data/dates";
import { useConfie } from "../data/queries";
import type { ConfieData } from "../data/schemas";
import { confieRoutes } from "../routes";
import { DataList } from "../ui/DataList";
import { ListRow, RowList } from "../ui/ListRow";
import { PageHeader } from "../ui/PageHeader";
import { Caption, Pair, Section } from "../ui/Section";
import { QueryBoundary } from "../ui/States";

export function AgenceScreen() {
  const query = useConfie();
  return <QueryBoundary query={query}>{(data) => <Agence data={data} />}</QueryBoundary>;
}

const telHref = (phone: string) => `tel:${phone.replace(/\s+/g, "")}`;

function Agence({ data }: { data: ConfieData }) {
  const { agency, mandate } = data;
  const ending = mandate.endRequest !== null;
  return (
    <>
      <PageHeader
        title={agency.name}
        crumbs={[{ label: "Échanges" }, { label: "Mon agence" }]}
        badges={<Badge tone={ending ? "warning" : "success"}>{ending ? "Fin de mandat demandée" : "Mandat en cours"}</Badge>}
        subtitle={`Agence gestionnaire de vos ${String(mandate.lotIds.length)} lots depuis le ${formatDate(mandate.signedOn)}.`}
        actions={
          <>
            <Button variant="secondary" asChild><Link href={confieRoutes.mandat}><Icon icon={Handshake} />Voir mon mandat</Link></Button>
            <Button asChild><Link href={confieRoutes.messageNouveau}><Icon icon={MessageSquare} />Écrire à l&apos;agence</Link></Button>
          </>
        }
      />
      <Pair>
        <Section title="Coordonnées">
          <DataList
            items={[
              { label: "Adresse", value: agency.address },
              { label: "Téléphone", value: <a href={telHref(agency.phone)} className="underline underline-offset-3">{agency.phone}</a> },
              { label: "E-mail", value: <a href={`mailto:${agency.email}`} className="underline underline-offset-3">{agency.email}</a> },
              { label: "Horaires", value: agency.hours },
              { label: "Site", value: <a href={agency.website} target="_blank" rel="noopener noreferrer" className="underline underline-offset-3">{agency.website}</a> },
            ]}
          />
        </Section>
        <Section title="Votre gestionnaire">
          <div className="flex items-center gap-2.5">
            <Avatar initials={agency.manager.initials} size="lg" />
            <span className="flex min-w-0 flex-col">
              <b className="text-body-strong text-fg">{agency.manager.name}</b>
              <Caption>{agency.manager.role}</Caption>
            </span>
          </div>
          <DataList
            items={[
              { label: "Ligne directe", value: <a href={telHref(agency.manager.directPhone)} className="underline underline-offset-3">{agency.manager.directPhone}</a> },
              { label: "E-mail", value: <a href={`mailto:${agency.manager.email}`} className="underline underline-offset-3">{agency.manager.email}</a> },
            ]}
          />
          <Button variant="secondary" asChild className="self-start">
            <Link href={confieRoutes.messageNouveau}><Icon icon={MessageSquare} />Écrire à {agency.manager.name.split(" ")[0]}</Link>
          </Button>
        </Section>
      </Pair>
      <Section title="Garanties professionnelles">
        <RowList label="Garanties professionnelles">
          {agency.guarantees.map((item) => (
            <ListRow key={item.id} icon={item.tone === "success" ? CircleCheck : TriangleAlert} tone={item.tone} title={item.title} detail={item.detail} trailing={<Badge tone={item.tone}>{item.badge}</Badge>} />
          ))}
        </RowList>
      </Section>
      <Section title="Votre mandat">
        <DataList
          width="lg"
          items={[
            { label: "Mandat", value: mandate.reference },
            { label: "Honoraires", value: `${String(mandate.feeRatePercent)} % TTC des loyers` },
            { label: "Reversement", value: `Le ${String(mandate.payoutDay)} de chaque mois` },
            { label: "Échéance", value: formatDate(mandate.endOn) },
          ]}
        />
        <Button variant="secondary" asChild className="self-start"><Link href={confieRoutes.mandat}>Voir le détail du mandat</Link></Button>
      </Section>
    </>
  );
}
