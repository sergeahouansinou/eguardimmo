import type { BadgeTone } from "@eguardimmo/ui";
import type { Pill } from "./labels";
import type { Invitation, InvitationStatus } from "./schemas";

export function invitationStatus(invitation: Invitation, todayIso: string): InvitationStatus {
  return invitation.status === "envoyee" && invitation.expiresIso < todayIso ? "expiree" : invitation.status;
}

const TONES: Record<InvitationStatus, BadgeTone> = { envoyee: "info", acceptee: "success", expiree: "warning", annulee: "neutral" };
const LABELS: Record<InvitationStatus, string> = { envoyee: "En attente", acceptee: "Acceptée", expiree: "Expirée", annulee: "Annulée" };

export function invitationPill(status: InvitationStatus): Pill {
  return { tone: TONES[status], label: LABELS[status] };
}

export const INVITATION_SEGMENTS = [
  { value: "toutes", label: "Toutes" },
  { value: "envoyee", label: "En attente" },
  { value: "acceptee", label: "Acceptées" },
  { value: "expiree", label: "Expirées" },
  { value: "annulee", label: "Annulées" },
] as const;

export type InvitationSegment = (typeof INVITATION_SEGMENTS)[number]["value"];
