import type { BadgeTone } from "@eguardimmo/ui";

export const REQUEST_STATUS: Readonly<Record<string, { label: string; tone: BadgeTone; detail: string }>> = {
  awaiting_code: { label: "Code à saisir", tone: "warning", detail: "Saisissez le code reçu par e-mail pour transmettre votre demande à l’agence." },
  pending: { label: "En attente d’approbation", tone: "info", detail: "Votre demande est transmise à l’agence, qui la vérifie avant de l’activer. Le compte actuel reste utilisé en attendant." },
  approved: { label: "Approuvée", tone: "success", detail: "L’agence a activé le nouveau compte de paiement." },
  rejected: { label: "Refusée ou abandonnée", tone: "danger", detail: "Cette demande n’a pas abouti : refus de l’agence ou nombre d’essais du code dépassé. Le compte actuel est conservé ; vous pouvez déposer une nouvelle demande." },
  withdrawn: { label: "Retirée", tone: "neutral", detail: "Vous avez retiré cette demande. Le compte actuel est conservé." },
  expired: { label: "Expirée", tone: "neutral", detail: "Cette demande a expiré sans suite. Le compte actuel est conservé ; vous pouvez déposer une nouvelle demande." },
};

export const LIVE_STATUSES: readonly string[] = ["awaiting_code", "pending"];
export const CODE_ATTEMPTS = 3;
export const PROOF_MAX_BYTES = 5 * 1024 * 1024;
export const PROOF_TYPES: readonly string[] = ["application/pdf", "image/jpeg", "image/png"];
