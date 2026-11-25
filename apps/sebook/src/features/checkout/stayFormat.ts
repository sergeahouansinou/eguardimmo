import { isIsoDay } from "@/lib/dates";
import type { I18nKey, Lang } from "@/lib/i18n/dictionaries";

const LOCALES: Record<Lang, string> = { fr: "fr-FR", en: "en-GB" };

export function formatDayLong(day: string, lang: Lang): string {
  if (!isIsoDay(day)) return day;
  return new Intl.DateTimeFormat(LOCALES[lang], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

export function formatDateTime(timestamp: string, lang: Lang): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return new Intl.DateTimeFormat(LOCALES[lang], { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function isPast(timestamp: string, now: Date): boolean {
  const time = new Date(timestamp).getTime();
  return !Number.isNaN(time) && time <= now.getTime();
}

type Translate = (key: I18nKey, params?: Record<string, string | number>) => string;

export function nightsText(t: Translate, count: number): string {
  return count === 1 ? t("bk_nightOne") : t("bk_nightsN", { n: count });
}

export function guestsText(t: Translate, count: number): string {
  return count === 1 ? t("bk_guestOne") : t("bk_guestsN", { n: count });
}
