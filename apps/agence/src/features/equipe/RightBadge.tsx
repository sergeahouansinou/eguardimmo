import { Badge } from "@eguardimmo/ui";
import type { BadgeTone } from "@eguardimmo/ui";
import { LEVEL_LABELS } from "./rights";
import type { RightLevel } from "./rights";

const TONES: Readonly<Record<RightLevel, BadgeTone>> = { edit: "success", read: "info", none: "neutral" };

export function RightBadge({ level }: { level: RightLevel }) {
  return <Badge tone={TONES[level]}>{LEVEL_LABELS[level]}</Badge>;
}
