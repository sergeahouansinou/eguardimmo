import { DEMO_TODAY, formatDateTime } from "@/features/shared/dates";
import type { Member } from "./schemas";

export function fullName(member: Pick<Member, "firstName" | "lastName">): string {
  return `${member.firstName} ${member.lastName}`;
}

export function initialsOfMember(member: Pick<Member, "firstName" | "lastName">): string {
  return `${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase();
}

export function lastLoginLabel(member: Member): string {
  if (member.online) return "En ligne";
  if (!member.lastLogin) return "Jamais";
  if (member.lastLogin.startsWith(DEMO_TODAY)) return `Aujourd'hui, ${member.lastLogin.slice(11, 16)}`;
  return formatDateTime(member.lastLogin);
}

export function twoFactorLabel(member: Member): string {
  if (member.twoFactor === "enabled") return "Activée";
  if (member.twoFactor === "disabled") return "Non activée";
  return "À l'acceptation";
}

export const STATUS_BADGES = {
  active: { tone: "success", label: "Actif" },
  invited: { tone: "warning", label: "Invitation envoyée" },
  inactive: { tone: "neutral", label: "Désactivé" },
} as const;
