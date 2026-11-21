import { Badge } from "@eguardimmo/ui";
import type { BadgeTone } from "@eguardimmo/ui";
import { LEVEL_LABELS } from "./rights";
import type { RightLevel } from "./rights";

const TONES: Readonly<Record<RightLevel, BadgeTone>> = { none: "neutral", read: "info", prepare: "warning", write: "success", write_two_factor: "success" };

export function RightBadge({ level }: { level: RightLevel }) {
  return <Badge tone={TONES[level]}>{LEVEL_LABELS[level]}</Badge>;
}
