import { Alert, Badge, Card, CardHeader, CardTitle } from "@eguardimmo/ui";
import { SummaryLines } from "@/features/kit";
import { RightBadge } from "./RightBadge";
import { ROLE_LABELS, ROLE_PANEL_RIGHT_IDS, rightsOfRole } from "./rights";
import type { RoleId } from "./rights";

export function RolePanel({ role }: { role: RoleId }) {
  return (
    <>
      <Card role="region" aria-label="Droits du rôle">
        <CardHeader>
          <CardTitle as="h2">Droits du rôle</CardTitle>
          <Badge>{ROLE_LABELS[role]}</Badge>
        </CardHeader>
        <SummaryLines
          lines={rightsOfRole(role, ROLE_PANEL_RIGHT_IDS).map((right) => ({
            label: right.label,
            value: <RightBadge level={right.level} />,
          }))}
        />
      </Card>
      <Alert tone="warning">Double authentification exigée dès la première connexion.</Alert>
    </>
  );
}
