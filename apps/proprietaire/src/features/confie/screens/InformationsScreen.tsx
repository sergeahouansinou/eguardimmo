"use client";

import { Alert, Button, Icon } from "@eguardimmo/ui";
import { Pencil } from "lucide-react";
import Link from "next/link";
import { formatDate } from "../data/dates";
import { useConfie } from "../data/queries";
import type { ConfieData } from "../data/schemas";
import { confieRoutes } from "../routes";
import { AccountTabs } from "../ui/AccountTabs";
import { DataList } from "../ui/DataList";
import { PageHeader } from "../ui/PageHeader";
import { Caption, Pair, Section } from "../ui/Section";
import { QueryBoundary } from "../ui/States";

export function InformationsScreen() {
  const query = useConfie();
  return <QueryBoundary query={query}>{(data) => <Informations data={data} />}</QueryBoundary>;
}

function Informations({ data }: { data: ConfieData }) {
  const { profile } = data;
  return (
    <>
      <PageHeader
        title="Mes informations"
        crumbs={[{ label: "Mes informations" }, { label: "Informations" }]}
        subtitle="Les coordonnées que l'agence utilise pour votre mandat et vos reversements."
        actions={<Button asChild><Link href={confieRoutes.informationsModifier}><Icon icon={Pencil} />Modifier mes informations</Link></Button>}
      />
      <AccountTabs current="informations" />
      {profile.pendingIbanChange ? (
        <Alert tone="info" title="Changement d'IBAN en attente">
          Demandé le {formatDate(profile.pendingIbanChange.requestedOn)} pour le compte •••• {profile.pendingIbanChange.ibanLast4}. Confirmez-le avec le code reçu par e-mail pour qu&apos;il soit pris en compte.
        </Alert>
      ) : null}
      <Pair>
        <Section title="Identité">
          <DataList
            width="lg"
            items={[
              { label: "Dénomination", value: profile.denomination },
              { label: "Forme", value: profile.legalForm },
              { label: "SIREN", value: profile.siren },
              { label: "Représentant", value: `${profile.representative}, ${profile.representativeRole}` },
              { label: "Régime fiscal", value: profile.taxRegime },
            ]}
          />
        </Section>
        <Section title="Coordonnées">
          <DataList
            width="lg"
            items={[
              { label: "Adresse", value: `${profile.street}, ${profile.postalCode} ${profile.city}` },
              { label: "Téléphone", value: profile.phone },
              { label: "E-mail", value: profile.email },
              { label: "Langue", value: profile.language },
            ]}
          />
        </Section>
      </Pair>
      <Pair>
        <Section title="Compte de reversement">
          <DataList
            width="lg"
            items={[
              { label: "Titulaire", value: profile.payout.holder },
              { label: "IBAN", value: `•••• ${profile.payout.ibanLast4}` },
              { label: "Modifié le", value: formatDate(profile.payout.changedOn) },
            ]}
          />
          <Caption>Le changement d&apos;IBAN demande un code de confirmation envoyé par e-mail.</Caption>
        </Section>
        <Section title="Confidentialité">
          <p className="text-body text-fg-muted">Vos informations ne sont visibles que de {data.agency.name}, pour la gestion de votre mandat.</p>
        </Section>
      </Pair>
    </>
  );
}
