import { Badge } from "@eguardimmo/ui";

export function PillBadge({ pill }: { pill: { tone: "neutral" | "info" | "success" | "warning" | "danger"; label: string } }) {
  return <Badge tone={pill.tone}>{pill.label}</Badge>;
}
