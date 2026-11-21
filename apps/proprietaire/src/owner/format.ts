import type { OwnerRole } from "./model";
import type { Money } from "./shared/model";

export const NOT_AVAILABLE = "Non renseigné";

export const ROLE_LABELS: Record<OwnerRole, string> = {
  holder: "Titulaire du mandat",
  representative: "Représentant du titulaire",
  co_owner: "Co-indivisaire (lecture seule)",
};

export function formatDay(iso: string): string {
  const [year = "", month = "", day = ""] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export function agencyLabel(name: string | null): string {
  return name ?? NOT_AVAILABLE;
}

const NARROW_SPACE = /\u202f/g;

export function formatMoney({ amount, currency }: Money): string {
  const reference = new Intl.NumberFormat("fr-FR", { style: "currency", currency });
  const digits = reference.resolvedOptions().maximumFractionDigits ?? 2;
  const scale = 10 ** digits;
  const whole = amount % scale === 0;
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency, minimumFractionDigits: whole ? 0 : digits, maximumFractionDigits: digits })
    .format(amount / scale)
    .replace(NARROW_SPACE, "\u00a0");
}

export function formatOptionalMoney(money: Money | null): string {
  return money === null ? NOT_AVAILABLE : formatMoney(money);
}

export function formatDateTime(iso: string): string {
  return `${formatDay(iso)} à ${iso.slice(11, 13)} h ${iso.slice(14, 16)}`;
}

export function formatOptionalDay(iso: string | null): string {
  return iso === null ? NOT_AVAILABLE : formatDay(iso);
}

export function formatPeriod(start: string, end: string): string {
  return `du ${formatDay(start)} au ${formatDay(end)}`;
}

export function formatMonth(yearMonth: string): string {
  const text = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${yearMonth}-15T12:00:00Z`));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatSurface(hundredths: number | null): string {
  if (hundredths === null) return NOT_AVAILABLE;
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(hundredths / 100).replace(NARROW_SPACE, "\u00a0")}\u00a0m²`;
}

export function formatFloor(floor: number | null): string {
  if (floor === null) return NOT_AVAILABLE;
  if (floor === 0) return "Rez-de-chaussée";
  return floor < 0 ? `Sous-sol ${String(Math.abs(floor))}` : floor === 1 ? "1er étage" : `${String(floor)}e étage`;
}

function formatScaled(value: number, divisor: number, suffix = ""): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(value / divisor).replace(NARROW_SPACE, "\u00a0")}${suffix}`;
}

export const formatBasisPoints = (basisPoints: number): string => formatScaled(basisPoints, 100, " %");
export const formatRatePcm = (pcm: number): string => formatScaled(pcm, 1000, " %");
export const formatQuantity = (milli: number): string => formatScaled(milli, 1000);

export function agencyAndMandant(agencyName: string | null, mandantName: string | null): string {
  return `${mandantName ?? NOT_AVAILABLE} · ${agencyLabel(agencyName)}`;
}

export function labelOf(labels: Readonly<Record<string, string>>, key: string): string {
  return labels[key] ?? "Non précisé";
}

export function formatAddress(address: { line1: string; line2: string | null; postalCode: string; city: string }): string {
  return [address.line1, address.line2, `${address.postalCode} ${address.city}`.trim()].filter((part) => part !== null && part !== "").join(", ");
}

const UNIT_TYPE_LABELS: Readonly<Record<string, string>> = {
  apartment: "Appartement",
  house: "Maison",
  studio: "Studio",
  parking: "Parking",
  garage: "Garage",
  cellar: "Cave",
  commercial_premises: "Local commercial",
  office: "Bureau",
  land: "Terrain",
};

export function unitTypeLabel(key: string): string {
  const known = UNIT_TYPE_LABELS[key];
  if (known !== undefined) return known;
  const text = key.replace(/_/g, " ").trim();
  return text === "" ? NOT_AVAILABLE : text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null) return NOT_AVAILABLE;
  if (bytes < 1024) return `${String(bytes)} o`;
  const units = ["Ko", "Mo", "Go"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)} ${units[index] ?? "Go"}`;
}
