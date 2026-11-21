"use client";

import { Badge, Button, EmptyState } from "@eguardimmo/ui";
import { Link2Off } from "lucide-react";
import Link from "next/link";
import { confieRoutes } from "@/features/confie/routes";
import { DataList } from "@/features/confie/ui/DataList";
import { PageHeader } from "@/features/confie/ui/PageHeader";
import { Section } from "@/features/confie/ui/Section";
import { ROLE_LABELS, agencyLabel, formatDay } from "../format";
import { useAgencies } from "../queries";
import { useOwnerSelection } from "../selection";
import { authLink, useOwnerSession } from "../session";
import { HomeData } from "../home/HomeData";
import { AccessSelector } from "./AccessSelector";
import { FailureNotice, Loading } from "./FailureNotice";
import { ReadOnlyBanner } from "./ReadOnlyBanner";

const SECTIONS = [
  { href: confieRoutes.biens, label: "Mes biens" },
  { href: confieRoutes.baux, label: "Baux" },
  { href: confieRoutes.loyers, label: "Loyers et reversements" },
  { href: confieRoutes.releve, label: "Relevé de compte" },
  { href: confieRoutes.comptesRendus, label: "Comptes rendus" },
  { href: confieRoutes.documents, label: "Documents" },
  { href: confieRoutes.factures, label: "Factures d’honoraires" },
  { href: confieRoutes.interventions, label: "Interventions" },
  { href: confieRoutes.fiscalite, label: "Fiscalité" },
  { href: confieRoutes.compteDePaiement, label: "Compte de paiement" },
  { href: confieRoutes.messages, label: "Messages" },
] as const;

function NoAccess() {
  const { authUrl } = useOwnerSession();
  const spaces = authLink(authUrl, "/profils");
  return (
    <EmptyState
      icon={Link2Off}
      title="Aucun accès à un mandat"
      description="Votre compte n’est relié à aucun mandat en cours. L’accès s’ouvre sur invitation de votre agence : ouvrez le lien reçu par e-mail et saisissez le code d’appariement qu’elle vous a remis."
    >
      {spaces ? (
        <Button asChild variant="secondary">
          <a href={spaces}>Choisir un autre espace</a>
        </Button>
      ) : null}
    </EmptyState>
  );
}

export function HomeScreen() {
  const agencies = useAgencies();
  const { accesses, selected, select } = useOwnerSelection();

  if (agencies.data === undefined) {
    return agencies.isError ? (
      <FailureNotice title="Vos mandats n’ont pas pu être chargés" error={agencies.error} onRetry={() => void agencies.refetch()} />
    ) : (
      <Loading label="Chargement de vos mandats" />
    );
  }

  return (
    <>
      <PageHeader
        title="Mon espace propriétaire"
        subtitle={selected ? `${selected.mandantName} · ${agencyLabel(selected.agencyName)}` : "Aucun mandat relié à votre compte"}
        badges={selected?.readOnly ? <Badge tone="warning">Lecture seule</Badge> : undefined}
      />
      {selected === null ? (
        <NoAccess />
      ) : (
        <>
          {agencies.isError ? <FailureNotice title="La liste de vos mandats n’a pas pu être actualisée" error={agencies.error} onRetry={() => void agencies.refetch()} /> : null}
          {accesses.length > 1 ? <AccessSelector accesses={accesses} selected={selected} onSelect={select} /> : null}
          <ReadOnlyBanner access={selected} />
          <HomeData agency={selected.agencyId} />
          <Section title="Mon accès">
            <DataList
              items={[
                { label: "Agence", value: agencyLabel(selected.agencyName) },
                { label: "Mandant", value: selected.mandantName },
                { label: "Mon rôle", value: ROLE_LABELS[selected.role] },
                { label: "Accès", value: selected.readOnly ? "Lecture seule" : "Consultation et décisions" },
                { label: "Valable jusqu’au", value: selected.accessUntil === null ? "Tant que votre mandat est en cours" : formatDay(selected.accessUntil) },
              ]}
            />
          </Section>
          <Section title="Consulter">
            <nav aria-label="Rubriques de votre espace" className="flex flex-wrap gap-2">
              {SECTIONS.map((section) => (
                <Button key={section.href} variant="secondary" asChild>
                  <Link href={section.href}>{section.label}</Link>
                </Button>
              ))}
            </nav>
          </Section>
          <div>
            <Button variant="secondary" asChild>
              <Link href={confieRoutes.agence}>Gérer mes accès</Link>
            </Button>
          </div>
        </>
      )}
    </>
  );
}
