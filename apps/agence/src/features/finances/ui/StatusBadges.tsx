import { Badge } from "@eguardimmo/ui";
import type { PaymentRow, ReversementRow } from "../schemas";

export function PaymentStatusBadge({ status }: { status: PaymentRow["status"] }) {
  if (status === "recu") return <Badge tone="success">Rapproché</Badge>;
  if (status === "a_rapprocher") return <Badge tone="warning">À rapprocher</Badge>;
  return <Badge tone="danger">Rejeté</Badge>;
}

export function ReversementStatusBadge({ row }: { row: Pick<ReversementRow, "status"> }) {
  if (row.status === "reverse") return <Badge tone="success">Reversé</Badge>;
  if (row.status === "bloque") return <Badge tone="danger">Bloqué</Badge>;
  return <Badge tone="info">À reverser</Badge>;
}
