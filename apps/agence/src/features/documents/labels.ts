import { LOTS, MANDANTS, TENANTS } from "@/features/shared/directory";
import { AGENCY_OWNER } from "./schemas";
import type { DocumentRecord } from "./schemas";

export type ShareTone = "neutral" | "info";

export function sharingPill(document: Pick<DocumentRecord, "sharedWithMandant" | "sharedWithTenant">): { label: string; tone: ShareTone } {
  if (document.sharedWithMandant && document.sharedWithTenant) return { label: "Mandant et locataire", tone: "info" };
  if (document.sharedWithMandant) return { label: "Mandant", tone: "info" };
  if (document.sharedWithTenant) return { label: "Locataire", tone: "info" };
  return { label: "Interne", tone: "neutral" };
}

export function attachmentLabel(document: Pick<DocumentRecord, "ownerId" | "lotId" | "tenantId">): string {
  if (document.tenantId) return TENANTS.find((tenant) => tenant.id === document.tenantId)?.name ?? document.tenantId;
  if (document.lotId) return LOTS.find((lot) => lot.id === document.lotId)?.label ?? document.lotId;
  if (document.ownerId === AGENCY_OWNER) return "Agence";
  return MANDANTS.find((mandant) => mandant.id === document.ownerId)?.name ?? document.ownerId;
}

export const OWNER_OPTIONS = [
  { value: AGENCY_OWNER, label: "Agence" },
  ...MANDANTS.map((mandant) => ({ value: mandant.id, label: `${mandant.name}, mandant` })),
] as const;

export function lotOptionsOf(ownerId: string): { value: string; label: string }[] {
  return LOTS.filter((lot) => lot.mandantId === ownerId).map((lot) => ({ value: lot.id, label: lot.label }));
}
