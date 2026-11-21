import type { BadgeTone } from "@eguardimmo/ui";

export const PAYOUT_STATUS: Readonly<Record<string, { label: string; tone: BadgeTone }>> = {
  pending: { label: "Programmé", tone: "info" },
  paid: { label: "Versé", tone: "success" },
  returned: { label: "Retourné par la banque", tone: "warning" },
};
