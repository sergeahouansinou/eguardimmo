import { toIso } from "@/lib/dates";

export function todayOf(date: Date): string {
  return toIso(date.getFullYear(), date.getMonth() + 1, date.getDate());
}
