"use client";

import { authUrl } from "@eguardimmo/shell";
import { Alert, Badge, Button, Icon } from "@eguardimmo/ui";
import { ExternalLink, KeyRound, Link2, ShieldCheck, Smartphone } from "lucide-react";
import { formatDate } from "../data/dates";
import { useConfie } from "../data/queries";
import type { ConfieData } from "../data/schemas";
import { AccountTabs } from "../ui/AccountTabs";
import { ListRow, RowList } from "../ui/ListRow";
import { PageHeader } from "../ui/PageHeader";
import { Section } from "../ui/Section";
import { QueryBoundary } from "../ui/States";

export function SecuriteScreen() {
  const query = useConfie();
  return <QueryBoundary query={query}>{(data) => <Securite data={data} />}</QueryBoundary>;
}

function ManageLink({ variant }: { variant: "primary" | "secondary" }) {
  return (
    <Button variant={variant} size={variant === "secondary" ? "sm" : "md"} asChild>
      <a href={authUrl("/compte/securite")} target="_blank" rel="noopener noreferrer">
        Gérer dans Mon compte
        <Icon icon={ExternalLink} />
        <span className="sr-only">, s&apos;ouvre dans un nouvel onglet</span>
      </a>
    </Button>
  );
}

function Securite({ data }: { data: ConfieData }) {
  const { security } = data;
  return (
    <>
      <PageHeader
        title="Sécurité"
        crumbs={[{ label: "Mes informations" }, { label: "Sécurité" }]}
        subtitle="Résumé de la sécurité de votre compte, commun à tous vos espaces."
        actions={<ManageLink variant="primary" />}
      />
      <AccountTabs current="securite" />
      <Alert tone="info" title="La sécurité se gère dans Mon compte">
        Mot de passe, double authentification et appareils sont les mêmes pour tous vos espaces eGuardImmo. Après vos modifications, vous revenez ici.
      </Alert>
      <Section title="Sécurité de votre compte" aside={<ManageLink variant="secondary" />}>
        <RowList label="Résumé de sécurité">
          <ListRow icon={KeyRound} title="Mot de passe" detail={`Modifié le ${formatDate(security.passwordChangedOn)}`} trailing={<Badge tone="success">{security.passwordStrength}</Badge>} />
          <ListRow icon={ShieldCheck} tone="success" title="Double authentification" detail={`${security.twoFactor} · ${String(security.backupCodes)} codes de secours restants`} trailing={<Badge tone="success">Activée</Badge>} />
          <ListRow icon={Link2} tone="default" title="Comptes liés" detail={security.linkedAccounts} trailing={<Badge>{String(security.linkedCount)} lié</Badge>} />
          <ListRow icon={Smartphone} tone="default" title="Appareils connectés" detail={`${String(security.devices)} appareils, dont cet appareil`} trailing={<Badge>{String(security.devices)}</Badge>} />
        </RowList>
      </Section>
    </>
  );
}
