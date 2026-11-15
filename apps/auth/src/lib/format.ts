const ZONE = "Europe/Paris";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { timeZone: ZONE, day: "2-digit", month: "2-digit", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("fr-FR", { timeZone: ZONE, hour: "2-digit", minute: "2-digit" });

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)}, ${timeFormat.format(new Date(iso))}`;
}

export function formatActivity(iso: string, now: Date): string {
  const date = new Date(iso);
  if (dateFormat.format(date) === dateFormat.format(now)) return `Aujourd’hui, ${timeFormat.format(date)}`;
  return formatDateTime(iso);
}

export function formatElapsed(iso: string, now: Date): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "aujourd’hui";
  if (days < 30) return `il y a ${String(days)} jour${days > 1 ? "s" : ""}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `il y a ${String(months)} mois`;
  const years = Math.floor(months / 12);
  return `il y a ${String(years)} an${years > 1 ? "s" : ""}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${String(seconds)} seconde${seconds > 1 ? "s" : ""}`;
  const minutes = Math.ceil(seconds / 60);
  return `${String(minutes)} minute${minutes > 1 ? "s" : ""}`;
}

export function formatDay(iso: string, now: Date): string {
  return dateFormat.format(new Date(iso)) === dateFormat.format(now) ? "aujourd’hui" : formatDate(iso);
}
