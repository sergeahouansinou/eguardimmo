import type { BadgeTone } from "@eguardimmo/ui";
import type { UnitState } from "./model";

export const NEXT_NOTICE_MESSAGES: Readonly<Record<string, string>> = {
  no_payout_account: "Aucun compte de versement n’est enregistré : renseignez-le pour recevoir vos reversements.",
  account_recently_changed: "Votre compte de versement a changé récemment : le prochain reversement attend la fin du délai de sécurité.",
  below_minimum: "Le montant à reverser n’atteint pas encore le minimum de versement.",
  before_payout_day: "Le jour de reversement de votre mandat n’est pas encore arrivé.",
};

export const NEXT_NOTICE_FALLBACK = "Votre agence examine ce reversement : il peut être décalé. Contactez-la pour en savoir plus.";

export function nextNoticeLabel(code: string): string {
  return NEXT_NOTICE_MESSAGES[code] ?? NEXT_NOTICE_FALLBACK;
}

export const UNIT_STATE: Readonly<Record<UnitState, { label: string; tone: BadgeTone }>> = {
  vacant: { label: "Vacant", tone: "neutral" },
  occupied: { label: "Occupé", tone: "success" },
  late: { label: "Loyer en retard", tone: "danger" },
};
