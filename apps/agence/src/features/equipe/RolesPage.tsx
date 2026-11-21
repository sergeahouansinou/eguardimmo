"use client";

import { Alert, Card, Icon } from "@eguardimmo/ui";
import { Users, UserPlus } from "lucide-react";
import { DataTable, LinkButton, PageFrame } from "@/features/kit";
import type { Column } from "@/features/kit";
import { RightBadge } from "./RightBadge";
import { RIGHTS, ROLE_IDS, ROLE_LABELS } from "./rights";

type Row = (typeof RIGHTS)[number];

const COLUMNS: readonly Column<Row>[] = [
  {
    id: "right",
    header: "Droit",
    role: "title",
    cell: (row) => (
      <span className="flex flex-col">
        {row.label}
        {row.remark ? <span className="text-caption font-normal text-fg-subtle">{row.remark}</span> : null}
      </span>
    ),
  },
  ...ROLE_IDS.map(
    (role): Column<Row> => ({ id: role, header: ROLE_LABELS[role], cell: (row) => <RightBadge level={row.levels[role]} /> }),
  ),
];

export function RolesPage() {
  return (
    <PageFrame
      crumbs={[{ label: "Équipe", href: "/equipe" }, { label: "Rôles et droits" }]}
      title="Rôles et droits"
      description="Ce que chaque rôle peut faire dans l'espace de l'agence."
      actions={
        <>
          <LinkButton href="/equipe">
            <Icon icon={Users} />
            Voir l'équipe
          </LinkButton>
          <LinkButton href="/equipe/invitation" variant="primary">
            <Icon icon={UserPlus} />
            Inviter un collaborateur
          </LinkButton>
        </>
      }
    >
      <Alert tone="info">
        Le périmètre « mandants choisis » n'est pas appliqué par le serveur : chaque membre voit tout le portefeuille, dans la limite des droits de son rôle. Le titulaire et l'administrateur ont les mêmes droits ; seul le titulaire ne peut être ni retiré ni changé de rôle.
      </Alert>
      <Card role="region" aria-label="Matrice des droits">
        <DataTable caption="Matrice des droits" columns={COLUMNS} rows={RIGHTS} getRowId={(row) => row.id} />
      </Card>
    </PageFrame>
  );
}
