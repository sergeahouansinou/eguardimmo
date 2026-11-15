import { Badge } from "@eguardimmo/ui";
import type { PieceStatus } from "./logic";

export function StatusBadge({ status }: { status: PieceStatus }) {
  return <Badge tone={status.tone}>{status.label}</Badge>;
}
