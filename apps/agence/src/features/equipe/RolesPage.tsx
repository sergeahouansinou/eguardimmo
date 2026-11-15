"use client";

import { Alert, Card } from "@eguardimmo/ui";
import { DataTable, LinkButton, PageFrame } from "@/features/kit";
import type { Column } from "@/features/kit";
import { RightBadge } from "./RightBadge";
import { RIGHTS, ROLE_IDS, ROLE_LABELS } from "./rights";

type Row = (typeof RIGHTS)[number];

const COLUMNS: readonly Column<Row>[] = [
  { id: "right", header: "Droit", role: "title", cell: (row) => row.label },
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
          <LinkButton href="/equipe">Voir l'équipe</LinkButton>
          <LinkButton href="/equipe/invitation" variant="primary">
            Inviter un collaborateur
          </LinkButton>
        </>
      }
    >
      <Alert tone="info">
        Un gestionnaire ne voit que les mandants qui lui sont confiés. Les autres rôles voient tout le portefeuille, dans la limite de leurs droits.
      </Alert>
      <Card role="region" aria-label="Matrice des droits">
        <DataTable caption="Matrice des droits" columns={COLUMNS} rows={RIGHTS} getRowId={(row) => row.id} />
      </Card>
    </PageFrame>
  );
}
